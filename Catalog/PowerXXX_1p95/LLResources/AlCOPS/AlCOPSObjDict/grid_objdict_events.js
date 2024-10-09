function grid::ClickElem(row,col)
{
	grid.EditMode(true)
}

function grid::GetTextColor(row,col)
{
	if (row == gridErrorPos.row && col == gridErrorPos.col)
		grid.EventResult = 0x0000FF
	else if (col == columns.ipa_num )
		grid.EventResult = 0xA0A0A0
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

		node = m_parentDevice.selectSingleNode("./params/param[ipa=" + ipa + "]/description | ./paramsRO/param[ipa=" + ipa + "]/description")
			
		if (node)
			grid.EventResult = node.text
		else
			grid.EventResult = ""
	}	
	else if (col == columns.index)
	{
		var result = window.external.DataGet(BuildPath(row,col), 0)
		result = app.CallFunction("common.sprintf", "0x%04X", result)
		grid.EventResult = result
	}
	else if (col == columns.subindex)
	{
		var result = window.external.DataGet(BuildPath(row,col), 0)
		result = app.CallFunction("common.sprintf", "0x%02X", result )
		grid.EventResult = result
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
	if (col == columns.index)	
	{	
	    s = parseInt( s, 16 )
	    
	    if (!CheckCANOpenIndexRange(s))
	    {
			grid.EventResult = false
			return
	    }
	}
	else if (col == columns.subindex)
	{	
	    s = parseInt( s, 16 )
	    
	    if (!CheckCANOpenSubindexRange(s))
	    {
			grid.EventResult = false
			return
	    }	    
	}
	
	app.DataSet(BuildPath(row,col), 0, s)
}

function grid::SetElemI(row,col,i)
{
	app.DataSet(BuildPath(row,col), 0, i)
	
	if (col == columns.ipa)
	{
		grid.Update(row, columns.description)
		grid.Update(row, columns.ipa_num)
	}
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
