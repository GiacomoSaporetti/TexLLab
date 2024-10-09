
/*function grid::Validate(row,col,value)
{
	grid_in.EventResult = ValidateColumnValue(grid, columns, row, col, value)
}*/

function grid_in::ClickElem(row,col)
{
	grid_in.EditMode(true)
}

function grid_in::GetTextColor(row,col)
{
	if (row == gridErrorPos.row && col == gridErrorPos.col)
		grid_in.EventResult = 0x0000FF
}

function BuildPath_in(row,col)
{
	return gridDatapath_in + "/*[" + (row+1) + "]/" + m_columnsNodes_in[col]
}

function grid_in::GetElemS(row,col)
{
	if (col == columns_in.address)
		grid_in.EventResult = parseInt(rdAddress.value) + row
	else
		grid_in.EventResult = app.DataGet(BuildPath_in(row,col), 0)
}

function grid_in::GetElemI(row,col)
{
	grid_in.EventResult = app.DataGet(BuildPath_in(row,col), 0)
}

function grid_in::SetElemS(row,col,s)
{
	if (col == columns_in.label && !m_disableModifyPLCVarAssigment && !m_useAlModbusStructSlaves)
	{
		var type = grid_in.Elem(grid_in.SelectedRow, columns_in.objtype)
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, true, type)
		
		// disattiva il filtro per i non booleani (per poter mappare ad es. un DINT su due registri)
		var allowTypes = (type == "BOOL") ? PLCVARTYPES_FIXED : PLCVARTYPES_ALL

		if ( m_useAlModbusRTU )
			s = ModifyPLCVarAssigment(grid_in, columns_in, s, type, allowTypes, dataBlock, undefined, "Modbus_Vars")
		else
			s = ModifyPLCVarAssigment(grid_in, columns_in, s, type, allowTypes, dataBlock)
		if (!s)
		{
			grid_in.EventResult = false
			return
		}
	}
	else if (col == columns_in.label && m_useAlModbusStructSlaves)
	{
		// label diventa nome del campo della struct, si assicura di normalizzarlo ora
		if (s != "")
			s = app.CallFunction("common.NormalizeName", s);
	}
	
	app.DataSet(BuildPath_in(row,col), 0, s)
}

function grid_in::SetElemI(row,col,i)
{
	app.DataSet(BuildPath_in(row,col), 0, i)
}

function grid_in::GetRecordNum()
{
	var list = app.SelectNodesXML(gridDatapath_in + "/*")
	if (list) grid_in.EventResult = list.length
}

function grid_in::PopupMenu(row, col, x, y)
{
	ShowGridPopup(grid_in, row, col, x, y)
}

function grid_in::ColClick(col)
{
	GridSort(grid_in, gridDatapath_in, col)
}

function grid_in::EndColTrack(col)
{
	m_gridColumnsChanged = true
}
