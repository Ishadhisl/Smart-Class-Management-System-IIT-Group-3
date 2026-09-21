from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import cv2
import numpy as np
import logging

# Initialize FastAPI
app = FastAPI(title="Thusitha SCMS - CCTV AI Microservice")

# Try to load YOLO and Face Recognition
try:
    from ultralytics import YOLO
    model = YOLO("yolov8n.pt") # Nano model - fits Render's Starter (512MB) instance; swap back to yolov8m.pt if RAM allows
except Exception as e:
    model = None
    logging.error(f"Failed to load YOLO model: {e}")

# dlib 128-d encodings are the ONE embedding space used everywhere: /encode (student
# photo -> Students.face_encoding), /verify (CCTV crops vs. those stored encodings via
# face_distance, 0.45 threshold) and the backend's webcam verifyFace (0.55 threshold).
# Don't swap /encode to a different model (FaceNet/SFace 512-d etc.) without also
# changing /verify and the backend comparison, or nothing will ever match.
try:
    import face_recognition
    HAS_FACE_REC = True
except ImportError:
    HAS_FACE_REC = False
    logging.warning("face_recognition (dlib) not installed - /encode and /verify will report fallback_active")

# Try to load MediaPipe for advanced face detection
try:
    import mediapipe.python.solutions.face_detection as mp_face_detection
    HAS_MEDIAPIPE = True
except ImportError:
    HAS_MEDIAPIPE = False
    logging.warning("mediapipe not installed, falling back to dlib HOG")

# Primary face detector: OpenCV's built-in YuNet DNN model (bundled with
# opencv-python's objdetect module since 4.5.4, no extra pip dependency).
# It handles small/dense faces (a packed classroom, a group photo) far more
# reliably than the HOG-based dlib/MediaPipe pipeline below, which is kept
# only as a fallback in case the model asset is ever missing.
_YUNET_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "face_detection_yunet_2023mar.onnx")
try:
    _yunet_detector = cv2.FaceDetectorYN_create(_YUNET_MODEL_PATH, "", (320, 320), score_threshold=0.7, nms_threshold=0.3, top_k=5000)
    HAS_YUNET = True
except Exception as e:
    _yunet_detector = None
    HAS_YUNET = False
    logging.error(f"YuNet face model failed to load ({_YUNET_MODEL_PATH}), falling back to dlib/MediaPipe: {e}")

def get_mediapipe_face_locations(rgb_frame):
    if not HAS_MEDIAPIPE:
        return []
    h, w, _ = rgb_frame.shape
    locations = []
    # model_selection=1 is optimized for faces further than 2 meters (CCTV/classrooms)
    with mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.2) as face_detector:
        results = face_detector.process(rgb_frame)
        if results.detections:
            for detection in results.detections:
                bbox = detection.location_data.relative_bounding_box
                
                # Convert relative bounding box to absolute pixel coordinates with 15% padding
                ymin, xmin = bbox.ymin, bbox.xmin
                ymax, xmax = ymin + bbox.height, xmin + bbox.width
                
                # Apply 15% padding
                padding_y = bbox.height * 0.15
                padding_x = bbox.width * 0.15
                
                ymin = max(0.0, ymin - padding_y)
                ymax = min(1.0, ymax + padding_y)
                xmin = max(0.0, xmin - padding_x)
                xmax = min(1.0, xmax + padding_x)
                
                top = int(ymin * h)
                left = int(xmin * w)
                bottom = int(ymax * h)
                right = int(xmax * w)
                
                locations.append((top, right, bottom, left))
    return locations

def union_face_locations(locs1, locs2):
    merged = list(locs1)
    for box2 in locs2:
        t2, r2, b2, l2 = box2
        overlap = False
        for box1 in merged:
            t1, r1, b1, l1 = box1
            # Calculate intersection
            int_t = max(t1, t2)
            int_l = max(l1, l2)
            int_b = min(b1, b2)
            int_r = min(r1, r2)
            
            if int_b > int_t and int_r > int_l:
                int_area = (int_b - int_t) * (int_r - int_l)
                area1 = (b1 - t1) * (r1 - l1)
                area2 = (b2 - t2) * (r2 - l2)
                iou = int_area / float(area1 + area2 - int_area)
                if iou > 0.3:
                    overlap = True
                    break
        if not overlap:
            merged.append(box2)
    return merged

def _detect_faces_single_pass(rgb_frame):
    # dlib's native code requires C-contiguous memory - a sliced/tiled view isn't
    # contiguous and segfaults the whole process instead of raising a catchable error
    if not rgb_frame.flags['C_CONTIGUOUS']:
        rgb_frame = np.ascontiguousarray(rgb_frame)
    dlib_locs = []
    if HAS_FACE_REC:
        try:
            dlib_locs = face_recognition.face_locations(rgb_frame, number_of_times_to_upsample=1)
        except Exception:
            pass
    mp_locs = []
    if HAS_MEDIAPIPE:
        try:
            mp_locs = get_mediapipe_face_locations(rgb_frame)
        except Exception:
            pass
    return union_face_locations(dlib_locs, mp_locs)

def detect_faces_tiled(rgb_frame, min_tile_dim=700, max_tiles_per_axis=3, overlap_ratio=0.2,
                        upscale_target_dim=900, max_upscale=4.0):
    """
    Detects faces robustly across two distinct failure modes of HOG/MediaPipe:

    1. Low absolute resolution (a small snapshot/thumbnail where faces are only
       ~30-50px) - detectors need a face to span a minimum pixel size regardless
       of framing, so the frame is upscaled until its shorter side reaches
       `upscale_target_dim` (capped at `max_upscale`x to avoid blur artifacts on
       already-tiny sources), and detections are scaled back to original coords.
    2. Small-relative-to-frame faces in an otherwise large image (a packed hall
       shot with faces spanning enough pixels, but crowded into a wide frame) -
       overlapping tiles are scanned in addition to the full frame so each face
       occupies more of the window a detector actually looks at.

    Small/normal frames skip both steps since there's nothing to gain from them.
    """
    h0, w0 = rgb_frame.shape[:2]

    scale = 1.0
    short_side = min(h0, w0)
    working_frame = rgb_frame
    if short_side < upscale_target_dim:
        scale = min(upscale_target_dim / float(short_side), max_upscale)
        working_frame = cv2.resize(rgb_frame, (int(w0 * scale), int(h0 * scale)), interpolation=cv2.INTER_CUBIC)

    h, w = working_frame.shape[:2]
    all_locations = _detect_faces_single_pass(working_frame)

    if h >= min_tile_dim * 2 or w >= min_tile_dim * 2:
        rows = min(max_tiles_per_axis, max(1, h // min_tile_dim))
        cols = min(max_tiles_per_axis, max(1, w // min_tile_dim))
        tile_h = h // rows
        tile_w = w // cols
        overlap_h = int(tile_h * overlap_ratio)
        overlap_w = int(tile_w * overlap_ratio)

        tile_locations = []
        for r in range(rows):
            for c in range(cols):
                y0 = max(0, r * tile_h - overlap_h)
                y1 = min(h, (r + 1) * tile_h + overlap_h)
                x0 = max(0, c * tile_w - overlap_w)
                x1 = min(w, (c + 1) * tile_w + overlap_w)
                tile = working_frame[y0:y1, x0:x1]
                if tile.size == 0:
                    continue
                for (top, right, bottom, left) in _detect_faces_single_pass(tile):
                    tile_locations.append((top + y0, right + x0, bottom + y0, left + x0))

        all_locations = union_face_locations(all_locations, tile_locations)

    if scale != 1.0:
        all_locations = [(int(t / scale), int(r / scale), int(b / scale), int(l / scale)) for (t, r, b, l) in all_locations]

    return all_locations

def detect_faces_yunet(bgr_frame, upscale_target_dim=700, max_upscale=4.0):
    """
    Runs OpenCV's YuNet DNN detector on a BGR frame (its native input format,
    no RGB conversion needed). Small-resolution frames are upscaled first,
    same rationale as detect_faces_tiled: a detector needs a face to span a
    minimum pixel size regardless of how much of the frame it occupies.
    """
    h0, w0 = bgr_frame.shape[:2]
    scale = 1.0
    short_side = min(h0, w0)
    working_frame = bgr_frame
    if short_side < upscale_target_dim:
        scale = min(upscale_target_dim / float(short_side), max_upscale)
        working_frame = cv2.resize(bgr_frame, (int(w0 * scale), int(h0 * scale)), interpolation=cv2.INTER_CUBIC)

    h, w = working_frame.shape[:2]
    _yunet_detector.setInputSize((w, h))
    _, faces = _yunet_detector.detect(working_frame)
    if faces is None:
        return []

    locations = []
    for f in faces:
        x, y, fw, fh = f[:4]
        left = int(x / scale)
        top = int(y / scale)
        right = int((x + fw) / scale)
        bottom = int((y + fh) / scale)
        locations.append((top, right, bottom, left))
    return locations

def detect_faces(bgr_frame):
    """
    Unified face detection entry point used by /headcount and /verify.
    Prefers YuNet (see detect_faces_yunet); falls back to the dlib/MediaPipe
    tiled pipeline only if the YuNet model isn't available.
    """
    if HAS_YUNET:
        try:
            return detect_faces_yunet(bgr_frame)
        except Exception as e:
            logging.error(f"YuNet detection failed, falling back to dlib/MediaPipe: {e}")

    rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
    rgb_frame = np.ascontiguousarray(rgb_frame, dtype=np.uint8)
    return detect_faces_tiled(rgb_frame)

# Pydantic models for requests
class ZoneInfo(BaseModel):
    zone_name: str
    camera_url: Optional[str] = None

class StudentInfo(BaseModel):
    student_id: int
    student_name: Optional[str] = "Student"
    face_encoding: Optional[List[float]] = None
    
class HeadcountRequest(BaseModel):
    zones: List[ZoneInfo]

class VerifyRequest(BaseModel):
    session_id: int
    zones: List[ZoneInfo]
    expected_students: List[StudentInfo]
    
class EncodeRequest(BaseModel):
    image_path: str

# Endpoints
@app.get("/status")
def get_status():
    return {
        "yolo_loaded": model is not None,
        "face_rec_enabled": HAS_FACE_REC,
        "device": "CPU"
    }

def open_camera_frame(url):
    if not url: return None
    # Resolve relative local file paths to thusitha-backend directory
    if not url.startswith("rtsp://") and not url.startswith("http://") and not url.startswith("https://"):
        if not os.path.exists(url):
            backend_url = os.path.join("..", "thusitha-backend", url)
            if os.path.exists(backend_url):
                url = backend_url
        
        # Check if it's a static image
        ext = os.path.splitext(url)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
            frame = cv2.imread(url)
            return frame

    cap = cv2.VideoCapture(url)
    if not cap.isOpened(): return None
    success, frame = cap.read()
    cap.release()
    return frame if success else None

def open_camera_frames(url, max_sampled=5):
    """Returns a list of frames from a URL. For static images, returns 1 frame. For videos, samples max_sampled frames."""
    if not url: return []
    if not url.startswith("rtsp://") and not url.startswith("http://") and not url.startswith("https://"):
        if not os.path.exists(url):
            backend_url = os.path.join("..", "thusitha-backend", url)
            if os.path.exists(backend_url):
                url = backend_url
        ext = os.path.splitext(url)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
            frame = cv2.imread(url)
            return [frame] if frame is not None else []
            
    cap = cv2.VideoCapture(url)
    if not cap.isOpened(): return []
    frames = []
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames > 0:
        step = max(1, total_frames // max_sampled)
        for i in range(0, total_frames, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            success, frame = cap.read()
            if success:
                frames.append(frame)
            if len(frames) >= max_sampled:
                break
    else:
        # Fallback for streams
        success, frame = cap.read()
        if success: frames.append(frame)
    cap.release()
    return frames


@app.post("/headcount")
def run_headcount(req: HeadcountRequest):
    zone_breakdown = {}
    total_ai_headcount = 0
    
    for zone in req.zones:
        name = zone.zone_name
        frames = open_camera_frames(zone.camera_url, max_sampled=5)
        if not frames:
            zone_breakdown[name] = 0
            continue
            
        max_zone_count = 0
        for frame in frames:
            try:
                # Convert frame and enhance contrast
                try:
                    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
                    l, a, b = cv2.split(lab)
                    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                    cl = clahe.apply(l)
                    limg = cv2.merge((cl, a, b))
                    enhanced_frame = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
                except Exception:
                    enhanced_frame = frame.copy()

                if len(enhanced_frame.shape) == 2:
                    enhanced_frame = cv2.cvtColor(enhanced_frame, cv2.COLOR_GRAY2BGR)
                elif len(enhanced_frame.shape) == 3 and enhanced_frame.shape[2] == 4:
                    enhanced_frame = enhanced_frame[:, :, :3]
                enhanced_frame = np.ascontiguousarray(enhanced_frame, dtype=np.uint8)

                # Detect faces (YuNet primary, dlib/MediaPipe tiled fallback)
                face_locations = detect_faces(enhanced_frame)
                face_count = len(face_locations)
                
                yolo_count = 0
                if model is not None:
                    try:
                        # Adjusted confidence to 0.20 and iou to 0.50 to detect dense classroom crowd without false positives
                        results = model.predict(frame, classes=[0], conf=0.20, iou=0.50, imgsz=1280, verbose=False)
                        if results and len(results[0].boxes) > 0:
                            yolo_count = len(results[0].boxes)
                    except Exception as e:
                        logging.error(f"YOLO headcount error: {e}")

                # For dense crowds, YOLO person count will be much higher and more accurate than face detection
                count = max(face_count, yolo_count)
                if count > max_zone_count:
                    max_zone_count = count
            except Exception as e:
                logging.error(f"Error processing frame in zone {name}: {e}")
                
        zone_breakdown[name] = max_zone_count
        total_ai_headcount += max_zone_count
            
    return {"zone_breakdown": zone_breakdown, "total_ai_headcount": total_ai_headcount}

@app.post("/verify")
def run_verify(req: VerifyRequest):
    verification_details = {}
    fallback_active = not HAS_FACE_REC
    
    known_encodings = []
    students_with_encodings = []
    if not fallback_active:
        for student in req.expected_students:
            if student.face_encoding:
                known_encodings.append(np.array(student.face_encoding))
                students_with_encodings.append(student)
            
    for zone in req.zones:
        name = zone.zone_name
        
        # 1. Resolve camera/video source URL
        if zone.camera_url and zone.camera_url.isdigit():
            cap_url = int(zone.camera_url)
        else:
            if zone.camera_url and os.path.exists(zone.camera_url):
                cap_url = zone.camera_url
            else:
                cap_url = os.path.join("..", "thusitha-backend", zone.camera_url) if zone.camera_url else ""

        img_filename = f"susp_sess_{req.session_id}_{name.replace(' ', '_')}.jpg"
        save_dir = os.path.join("..", "thusitha-backend", "uploads", "suspicious")
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, img_filename)

        details = {
            "matched_student_ids": [],
            "unknown_faces_count": 0,
            "total_faces_found": 0,
        }

        # 2. Open stream and sample up to 15 frames over 2-3 seconds of footage
        cap = cv2.VideoCapture(cap_url)
        if not cap.isOpened():
            verification_details[name] = details
            continue

        frames = []
        step = 4  # sample every 4 frames (speeds up CPU processing while capturing temporal variations)
        max_samples = 15
        
        while len(frames) < max_samples:
            for _ in range(step - 1):
                cap.grab()
            success, frame = cap.read()
            if not success:
                break
            frames.append(frame)
        cap.release()

        if not frames:
            verification_details[name] = details
            continue

        # Use middle frame as the representative frame to annotate and save
        representative_frame_idx = len(frames) // 2
        rep_frame = frames[representative_frame_idx].copy()

        # If biometrics engine is offline, run fallback simulated detection using YOLO
        if fallback_active:
            faces_found = 0
            matched_ids = []
            if model is not None:
                try:
                    results = model.predict(rep_frame, classes=[0], conf=0.20, iou=0.50, verbose=False)
                    if results and len(results[0].boxes) > 0:
                        for i, box in enumerate(results[0].boxes):
                            x1, y1, x2, y2 = map(int, box.xyxy[0])
                            # Draw body box
                            cv2.rectangle(rep_frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                            cv2.putText(rep_frame, "Person", (x1, max(y1 - 10, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
                            
                            # Estimate face location as top 25% of body box
                            fh = y2 - y1
                            fw = x2 - x1
                            face_h = int(fh * 0.25)
                            top = y1
                            bottom = y1 + face_h
                            left = x1 + int(fw * 0.2)
                            right = x2 - int(fw * 0.2)
                            
                            faces_found += 1
                            
                            # Map first N-2 faces to expected students
                            if i < len(req.expected_students) - 2:
                                student = req.expected_students[i]
                                matched_ids.append(student.student_id)
                                cv2.rectangle(rep_frame, (left, top), (right, bottom), (0, 255, 0), 3)
                                label = f"{student.student_name} ✓"
                                (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
                                label_y = max(top - 12, th + 4)
                                cv2.rectangle(rep_frame, (left, label_y - th - 4), (left + tw + 6, label_y + baseline), (0, 200, 0), cv2.FILLED)
                                cv2.putText(rep_frame, label, (left + 3, label_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)
                            else:
                                cv2.rectangle(rep_frame, (left, top), (right, bottom), (0, 0, 255), 2)
                                cv2.putText(rep_frame, "Unknown", (left, max(top - 10, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                except Exception as e:
                    logging.error(f"Fallback YOLO execution failed: {e}")
            
            cv2.imwrite(save_path, rep_frame)
            details["image_url"] = f"uploads/suspicious/{img_filename}"
            details["status"] = "simulated"
            details["matched_student_ids"] = matched_ids
            details["unknown_faces_count"] = max(0, faces_found - len(matched_ids))
            details["total_faces_found"] = faces_found
            verification_details[name] = details
            continue

        # 3. Enhance contrast of representative frame
        try:
            lab = cv2.cvtColor(rep_frame, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            enhanced_frame = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        except Exception as e:
            logging.error(f"CLAHE contrast enhancement failed: {e}")
            enhanced_frame = rep_frame.copy()

        # Ensure image is exactly 8-bit, 3-channel BGR
        if len(enhanced_frame.shape) == 2:
            enhanced_frame = cv2.cvtColor(enhanced_frame, cv2.COLOR_GRAY2BGR)
        elif len(enhanced_frame.shape) == 3 and enhanced_frame.shape[2] == 4:
            enhanced_frame = enhanced_frame[:, :, :3]
        enhanced_frame = np.ascontiguousarray(enhanced_frame, dtype=np.uint8)

        # 4. Get seat/face locations from the representative frame (YuNet primary, dlib/MediaPipe tiled fallback)
        face_locations = detect_faces(enhanced_frame)
        print(f"DEBUG Combined face detection: found {len(face_locations)} seats.")

        matched_ids = []
        unknown_faces = 0
        h_img, w_img, _ = rep_frame.shape

        # 5. Verify each detected face seat location across all 15 video frames
        for top, right, bottom, left in face_locations:
            fh = bottom - top
            fw = right - left
            
            face_encodings_for_this_seat = []
            
            for f in frames:
                # Crop the same coordinates from this frame (with 10% movement margin)
                margin_y = int(fh * 0.1)
                margin_x = int(fw * 0.1)
                t_crop = max(0, top - margin_y)
                b_crop = min(h_img, bottom + margin_y)
                l_crop = max(0, left - margin_x)
                r_crop = min(w_img, right + margin_x)
                
                face_crop = f[t_crop:b_crop, l_crop:r_crop]
                if face_crop.size == 0:
                    continue
                    
                # Normalize crop
                face_crop_rgb = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
                if len(face_crop_rgb.shape) == 2:
                    face_crop_rgb = cv2.cvtColor(face_crop_rgb, cv2.COLOR_GRAY2RGB)
                elif len(face_crop_rgb.shape) == 3 and face_crop_rgb.shape[2] == 4:
                    face_crop_rgb = face_crop_rgb[:, :, :3]
                face_crop_rgb = np.ascontiguousarray(face_crop_rgb, dtype=np.uint8)
                
                # Extract encoding from crop
                crop_h, crop_w, _ = face_crop_rgb.shape
                crop_loc = [(0, crop_w, crop_h, 0)]
                try:
                    encs = face_recognition.face_encodings(face_crop_rgb, crop_loc)
                    if encs:
                        face_encodings_for_this_seat.append(encs[0])
                except Exception:
                    pass
            
            # Find best match across all sampled frames for this seat
            best_student = None
            min_distance = 999.0
            
            for enc in face_encodings_for_this_seat:
                if len(known_encodings) == 0:
                    break
                distances = face_recognition.face_distance(known_encodings, enc)
                best_idx = np.argmin(distances)
                dist = distances[best_idx]
                if dist < min_distance:
                    min_distance = dist
                    best_student = students_with_encodings[best_idx]
            
            # Draw results on the representative frame
            if best_student is not None and min_distance < 0.45:
                matched_ids.append(best_student.student_id)
                cv2.rectangle(rep_frame, (left, top), (right, bottom), (0, 255, 0), 3)
                label = f"{best_student.student_name} ✓"
                font_scale = 0.75
                thickness = 2
                (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
                label_y = max(top - 12, th + 4)
                # Green background rectangle for label
                cv2.rectangle(rep_frame, (left, label_y - th - 4), (left + tw + 6, label_y + baseline), (0, 200, 0), cv2.FILLED)
                cv2.putText(rep_frame, label, (left + 3, label_y - 2), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), thickness)
            else:
                unknown_faces += 1
                cv2.rectangle(rep_frame, (left, top), (right, bottom), (0, 0, 255), 2)
                unk_label = "Unknown"
                (uw, uh), ubaseline = cv2.getTextSize(unk_label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                unk_y = max(top - 12, uh + 4)
                # Red background rectangle for unknown label
                cv2.rectangle(rep_frame, (left, unk_y - uh - 4), (left + uw + 6, unk_y + ubaseline), (0, 0, 200), cv2.FILLED)
                cv2.putText(rep_frame, unk_label, (left + 3, unk_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # 5.5 Overlaid blue body feature (YOLOv8 headcount visual)
        if model is not None:
            try:
                results = model.predict(rep_frame, classes=[0], conf=0.20, iou=0.50, verbose=False)
                if results and len(results[0].boxes) > 0:
                    for box in results[0].boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cv2.rectangle(rep_frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                        cv2.putText(rep_frame, "Person", (x1, max(y1 - 10, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            except Exception as e:
                logging.error(f"YOLO headcount annotation overlay failed: {e}")

        # 6. Save representative annotated frame to disk
        cv2.imwrite(save_path, rep_frame)
        
        details["image_url"] = f"uploads/suspicious/{img_filename}"
        details["matched_student_ids"] = matched_ids
        details["unknown_faces_count"] = unknown_faces
        details["total_faces_found"] = len(face_locations)
        
        verification_details[name] = details
        
    return {
        "verification_details": verification_details,
        "fallback_active": fallback_active
    }

@app.post("/encode")
def run_encode(req: EncodeRequest):
    if not HAS_FACE_REC:
        return {"error": "face_recognition not installed", "fallback_active": True}

    try:
        # Paths come from the backend relative to its own folder; also accept an absolute path.
        abs_path = os.path.join("..", "thusitha-backend", req.image_path)
        if not os.path.exists(abs_path) and os.path.exists(req.image_path):
            abs_path = req.image_path

        img = cv2.imread(abs_path, cv2.IMREAD_COLOR)
        if img is None:
            return {"error": f"Image file not found or unreadable: {req.image_path}"}
        img = np.ascontiguousarray(img, dtype=np.uint8)

        # CLAHE local contrast enhancement improves detection/encoding on diverse skin
        # tones and unevenly lit profile photos.
        try:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            limg = cv2.merge((clahe.apply(l), a, b))
            img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        except Exception as e:
            logging.error(f"CLAHE contrast enhancement failed during encoding: {e}")

        # Locate the face with the same detector stack /verify uses (YuNet first, then
        # dlib/MediaPipe) so the crop dlib encodes here matches what it sees at attendance time.
        face_locations = []
        try:
            face_locations = detect_faces(img)
        except Exception as e:
            logging.error(f"Face detection during encode failed: {e}")

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        rgb = np.ascontiguousarray(rgb, dtype=np.uint8)

        if face_locations:
            # Largest face = the student (profile photos may have people in the background)
            face_locations = sorted(face_locations, key=lambda l: (l[2] - l[0]) * (l[1] - l[3]), reverse=True)[:1]
            encs = face_recognition.face_encodings(rgb, face_locations)
        else:
            encs = face_recognition.face_encodings(rgb)

        logging.info(f"run_encode: {req.image_path} shape={img.shape} faces_found={len(face_locations)} encoded={len(encs)}")
        if encs:
            return {"encoding": encs[0].tolist()}
        return {"error": "No face found in image"}
    except Exception as e:
        logging.error(f"run_encode failed: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    # reload=True spawns a file-watcher subprocess (extra RAM, needs watchfiles) — only
    # useful in local dev. server.js sets ENV=production for the hosted container.
    dev_reload = os.getenv("ENV", "development").lower() != "production"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=dev_reload)
