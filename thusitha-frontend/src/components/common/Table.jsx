import PropTypes from 'prop-types';

/**
 * Shared table shell: horizontally scrollable wrapper (prevents mobile
 * layout breakage), sticky-style header, consistent row/cell spacing.
 * Usage mirrors a plain <table> — pass <thead>/<tbody> children as usual.
 * All cell/row components spread extra props (colSpan, onClick, etc.) through.
 */
export const Table = ({ children, className = '', ...rest }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
    <table className={`w-full text-sm border-collapse ${className}`} {...rest}>{children}</table>
  </div>
);

export const THead = ({ children, ...rest }) => (
  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500" {...rest}>
    {children}
  </thead>
);

export const TBody = ({ children, ...rest }) => <tbody className="divide-y divide-slate-100" {...rest}>{children}</tbody>;

export const TRow = ({ children, className = '', ...rest }) => (
  <tr className={`hover:bg-slate-50/80 transition-colors ${className}`} {...rest}>{children}</tr>
);

export const TH = ({ children, className = '', ...rest }) => (
  <th className={`px-4 py-3 font-bold whitespace-nowrap ${className}`} {...rest}>{children}</th>
);

export const TD = ({ children, className = '', ...rest }) => (
  <td className={`px-4 py-3 align-middle text-slate-700 ${className}`} {...rest}>{children}</td>
);

const nodeProp = PropTypes.node;
Table.propTypes = { children: nodeProp, className: PropTypes.string };
THead.propTypes = { children: nodeProp };
TBody.propTypes = { children: nodeProp };
TRow.propTypes = { children: nodeProp, className: PropTypes.string };
TH.propTypes = { children: nodeProp, className: PropTypes.string };
TD.propTypes = { children: nodeProp, className: PropTypes.string };
