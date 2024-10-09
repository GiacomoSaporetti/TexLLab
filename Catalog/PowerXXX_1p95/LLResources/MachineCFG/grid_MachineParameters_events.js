
/*function grid::Validate(row,col,value)
{
	return ValidateColumnValue(grid, columns, row, col, value)
}*/

function grid::ClickElem(row,col)
{
	grid.EditMode(true)
}

function grid::GetTextColor(row,col)
{
	if (row == gridErrorPos.row && col == gridErrorPos.col)
		grid.EventResult = 0x0000FF
}

function DataGet(row, col) {
	return m_itemMap[m_itemPositionList[row]][m_columnsNodes[col]];
}

function DataGetDirect(row, colName) {
	return m_itemMap[m_itemPositionList[row]][colName];
}

function DataSet(row,col,data) {
	let realID = m_itemPositionList[row];
	let qry = gridDatapath + "/*[uniqueID='" + realID + "']/" + m_columnsNodes[col];

	app.DataSet(qry, 0, data);
	m_itemMap[m_itemPositionList[row]][m_columnsNodes[col]] = data;
}

function grid::GetElemS(row,col)
{
	grid.EventResult = DataGet(row,col)
}

function grid::GetElemI(row,col)
{
	grid.EventResult = DataGet(row,col)
}

function grid::SetElemS(row,col,s)
{
	DataSet(row, col, s);
}

function grid::SetElemI(row,col,i)
{
	DataSet(row, col, i);
}

function grid::GetRecordNum()
{
	grid.EventResult = m_itemPositionList.length;
}

function grid::PopupMenu(row, col, x, y)
{
	if (rowTemplate)
		ShowGridPopup(grid, row, col, x, y, gridDatapath, rowTemplate, "menu_gridPopup")
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, param)
{
	if (rowTemplate)
		GridSpecialEvent(id, param, grid, gridDatapath, rowTemplate)
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}

function grid::GetColType(row, col)
{
	if(col == columns.value)
	{
		var enumValues = DataGetDirect((row), "enumValues")
		if(enumValues)
			grid.EventResult = egColumnType.egCombo;
		else
			grid.EventResult = egColumnType.egEdit;
	}
}

function grid::GetEnum(row,col)
{
	var uniqueID = grid.Elem(row, columns.uniqueID);
	grid.EventResult = "enum_" + uniqueID;
}

function isReadOnly(row, col) {
	let pageNum = parseInt(DataGetDirect(row, "pageNumber"));
	let id = parseInt(DataGetDirect(row, "uniqueID"));

	return (READ_ONLY_PARS[pageNum] && READ_ONLY_PARS[pageNum].includes(id));
}

function grid::AllowEdit(row,col)
{
	if (col == columns.value)
		grid.EventResult = !isReadOnly(row, col);
}

function grid::GetBkColor(row,col)
{
	grid.EventResult = isReadOnly(row, col) ? 0xDDDDDD : 0xFFFFFF;
}