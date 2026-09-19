const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\ishad\\Downloads\\Media marks.xlsx');
  const ws = wb.getWorksheet(1);
  console.log('Sheet name:', ws.name, 'rowCount:', ws.rowCount);
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const vals = [1,2,3].map(i => {
      const c = row.getCell(i);
      return JSON.stringify(c.value);
    });
    console.log(rowNumber, vals.join(' | '));
  });
})().catch(e => console.error('ERROR', e));
