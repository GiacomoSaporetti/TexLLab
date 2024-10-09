
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

// legge valore dalla definizione dell'elemento di IO
function GetElemFromIODef(row, col)
{
	// la chiave di ricerca è l'id
	var qry = "io[@id = " + grid.Elem(row, columns.id) + "]/" + m_columnsNodes[col]
	var node = m_LocalIODef.selectSingleNode(qry)
	if (node)
		return node.text
}

function grid::GetElemS(row,col)
{
	if (col == columns.name || col == columns.type || col == columns.dataBlock || col == columns.description)
		// colonne fisse dalla definizione del IO
		grid.EventResult = GetElemFromIODef(row, col)
	else
		grid.EventResult = window.external.DataGet(BuildPath(row,col), 0)
}

function grid::GetElemI(row,col)
{
	grid.EventResult = window.external.DataGet(BuildPath(row,col), 0)
}

function grid::SetElemS(row,col,s)
{
	if (col == columns.label && !m_disableModifyPLCVarAssigment)
	{
		var type = grid.Elem(row, columns.type)
		var dataBlock = grid.Elem(row, columns.dataBlock)
		
		// passa un set di indici di colonne ridotto per non causare modifiche alle altre (solo la label)
		var c = { label: columns.label }
		s = ModifyPLCVarAssigment(grid, c, s, type, PLCVARTYPES_SAMESIZE, dataBlock, PLCVARASSIGN_ONLYAUTO | PLCVARASSIGN_ONLYSIMPLE | PLCVARASSIGN_HIDEDIALOG, m_globalGroupName)
		if (!s)
		{
			grid.EventResult = false
			return
		}
	}
	
	window.external.DataSet(BuildPath(row,col), 0, s)
}

function grid::SetElemI(row,col,i)
{
	window.external.DataSet(BuildPath(row,col), 0, i)
}

function grid::GetRecordNum()
{
	var nodelist = m_LocalIODef.selectNodes("io");
	grid.EventResult = nodelist.length;
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
