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
	if (col == columns.description)
	{
		var ipa = parseInt(grid.Elem(row, columns.ipa))
		var node

		node = m_parentDevice.selectSingleNode("config/params/param[ipa=" + ipa + "]/description | config/paramsRO/param[ipa=" + ipa + "]/description")
			
		if (node)
			grid.EventResult = node.text
		else
			grid.EventResult = ""
	}
	else
		grid.EventResult = app.DataGet(BuildPath(row,col), 0)
}

function grid::GetElemI(row,col)
{
	grid.EventResult = app.DataGet(BuildPath(row,col), 0)
}

function grid::SetElemS(row,col,s)
{
	app.DataSet(BuildPath(row,col), 0, s)
}

function grid::SetElemI(row,col,i)
{
	app.DataSet(BuildPath(row,col), 0, i)
	
	if (col == columns.ipa)
		grid.Update(row, columns.description)
}

function grid::GetRecordNum()
{
	var list = app.SelectNodesXML(gridDatapath + "/*")
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
