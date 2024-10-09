
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

function BuildPath(row,col)
{
	return gridDatapath + "/*[" + (row+1) + "]/" + m_columnsNodes[col]
}

function grid::GetElemS(row,col)
{
	grid.EventResult = window.external.DataGet(BuildPath(row,col), 0)
}

function grid::GetElemI(row,col)
{
	grid.EventResult = window.external.DataGet(BuildPath(row,col), 0)
}

function grid::SetElemS(row,col,s)
{
	window.external.DataSet(BuildPath(row,col), 0, s)
}

function grid::SetElemI(row,col,i)
{
	window.external.DataSet(BuildPath(row,col), 0, i)
}

function grid::GetRecordNum()
{
	var list = window.external.SelectNodesXML(gridDatapath + "/*")
	if (list) grid.EventResult = list.length
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
