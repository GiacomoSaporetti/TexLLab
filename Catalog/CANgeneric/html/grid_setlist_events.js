
function grid::ClickElem(row,col)
{
	grid.EditMode(true)
}

function BuildPath(row,col)
{
	return gridDatapath + "/*[" + (row+1) + "]/" + m_columnsNodes[col]
}

function grid::GetElemS(row,col)
{
	var s = window.external.DataGet(BuildPath(row,col), 0)
	if (col == columns.index || col == columns.subindex)
		grid.EventResult = parseInt(s).toString(16)
	else
		grid.EventResult = s
}

function grid::GetElemI(row,col)
{
	grid.EventResult = window.external.DataGet(BuildPath(row,col), 0)
}

function grid::SetElemS(row,col,s)
{
  var oldvalue = grid.Elem(row, col)

  if (oldvalue == s) return

	window.external.DataSet(BuildPath(row,col), 0, s)
	
	CheckPDOTransmission(row)
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
	ShowGridPopup(grid, row, col, x, y, gridDatapath)
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, param)
{
	GridSpecialEvent(id, param, grid, gridDatapath, undefined)
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}
