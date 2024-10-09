
function grid::ClickElem(row,col)
{
	grid.EditMode(true)
}

function grid::GetTextColor(row,col)
{
	if ( m_SDOSchedulingSupportedVersion >= SDO_SCHEDULING_VER_2 )
	{
		if (col == columns.polling)
		{
			var oneshot = grid.Elem( row, columns.oneshot )
			grid.EventResult = ( oneshot == "" ) ? 0x000000 : 0xC0C0C0
		}
	}
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
	if (col == columns.label && !m_disableModifyPLCVarAssigment)
	{
		var type = grid.Elem(row, columns.objtype)
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", false, type)
		
		// passa un set di indici di colonne ridotto per non causare modifiche alle altre (no size)
		var c = { label: columns.label, type: columns.type, dataBlock: columns.dataBlock }
		
		s = ModifyPLCVarAssigment(grid, c, s, type, PLCVARTYPES_SAMESIZE, dataBlock, undefined, m_globalGroupName)
		if (!s)
		{
			grid.EventResult = false
			return
		}
	}
	else if ( m_SDOSchedulingSupportedVersion >= SDO_SCHEDULING_VER_2 && col == columns.oneshot && !m_disableModifyPLCVarAssigment)
	{
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", false, 'BOOL')
	
		var c = { label: columns.oneshot }
		s = ModifyPLCVarAssigment(grid, c, s, 'BOOL', PLCVARTYPES_FIXED, dataBlock, undefined, m_globalGroupName)
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

function grid::OptionClick(row,col)
{
	if ( m_SDOSchedulingSupportedVersion >= SDO_SCHEDULING_VER_2 )
	{
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", false, 'BOOL')
	
		var c = { label: columns.oneshot }
		AssignPLCVar(grid, c, "BOOL", dataBlock, undefined, m_globalGroupName)
	}
}

function grid::AllowEdit(row,col)
{
	if ( m_SDOSchedulingSupportedVersion >= SDO_SCHEDULING_VER_2 )
	{
		if (col == columns.polling)
		{
			var oneshot = grid.Elem( row, columns.oneshot )
			grid.EventResult = ( oneshot == "" )
		}
		else
			grid.EventResult = true
	}
	else
	{
		grid.EventResult = true
	}
}
