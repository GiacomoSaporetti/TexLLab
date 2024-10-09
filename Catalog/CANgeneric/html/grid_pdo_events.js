/*
function grid::Validate(row,col,value)
{
	grid.EventResult = ValidateColumnValue(grid, columns, row, col, value)
}*/

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
	if (col == columns.index || col == columns.subindex )
		// visualizza in hex per index, subindex
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
	if (col == columns.label && !m_disableModifyPLCVarAssigment)
	{
		var type = grid.Elem(row, columns.objtype)
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", m_isPDOTx, type)
		
		// passa un set di indici di colonne ridotto per non causare modifiche alle altre (no size)
		var c = { label: columns.label, type: columns.type, dataBlock: columns.dataBlock }
		
		s = ModifyPLCVarAssigment(grid, c, s, type, PLCVARTYPES_SAMESIZE, dataBlock, undefined, m_globalGroupName)
		if (!s)
		{
			grid.EventResult = false
			return
		}
	}
	
	var s_old = window.external.DataGet( BuildPath(row,col), 0 )
	
	window.external.DataSet(BuildPath(row,col), 0, s)
	
	if (col == columns.numPDO)
	{
		grid.Elem(row, columns.COBIDstr) = GetCOBIDstr(row, parseInt( s ))
	}
	else if ( col == columns.COBIDstr )
	{
		SetCOBIDstr(grid.Elem(row, columns.numPDO), s)
	}
	
	if (col == columns.bitstart || col == columns.COBIDstr )	//	non eseguo l'update su cambio del numero PDO perchè chiama automaticamente l'aggiornamento del COBIDstr
	{
		if ( s_old != s ) UpdatePDO()
	}
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
	ShowGridPopup(grid, row, col, x, y)
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, param)
{
	GridSpecialEvent(id, param, grid)
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}
