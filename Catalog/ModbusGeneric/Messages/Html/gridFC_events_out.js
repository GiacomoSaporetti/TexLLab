
/*function grid::Validate(row,col,value)
{
	grid_out.EventResult = ValidateColumnValue(grid, columns, row, col, value)
}*/

function grid_out::ClickElem(row,col)
{
	grid_out.EditMode(true)
}

function grid_out::GetTextColor(row,col)
{
	if (row == gridErrorPos.row && col == gridErrorPos.col)
		grid_out.EventResult = 0x0000FF
}

function BuildPath_out(row,col)
{
	return gridDatapath_out + "/*[" + (row+1) + "]/" + m_columnsNodes_out[col]
}

function grid_out::GetElemS(row,col)
{
	if (col == columns_out.address)
		grid_out.EventResult = parseInt(wrAddress.value) + row
	else
		grid_out.EventResult = app.DataGet(BuildPath_out(row,col), 0)
}

function grid_out::GetElemI(row,col)
{
	grid_out.EventResult = app.DataGet(BuildPath_out(row,col), 0)
}

function grid_out::SetElemS(row,col,s)
{
	if (col == columns_out.label && !m_disableModifyPLCVarAssigment && !m_useAlModbusStructSlaves)
	{
		var type = grid_out.Elem(grid_out.SelectedRow, columns_out.objtype)
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, false, type)
		
		// disattiva il filtro per i non booleani (per poter mappare ad es. un DINT su due registri)
		var allowTypes = (type == "BOOL") ? PLCVARTYPES_FIXED : PLCVARTYPES_ALL
		
		if ( m_useAlModbusRTU )
			s = ModifyPLCVarAssigment(grid_out, columns_out, s, type, allowTypes, dataBlock, undefined, "Modbus_Vars")
		else
			s = ModifyPLCVarAssigment(grid_out, columns_out, s, type, allowTypes, dataBlock)
		if (!s)
		{
			grid_out.EventResult = false
			return
		}
	}
	else if (col == columns_out.label && m_useAlModbusStructSlaves)
	{
		// label diventa nome del campo della struct, si assicura di normalizzarlo ora
		if (s != "")
			s = app.CallFunction("common.NormalizeName", s);
	}
	
	app.DataSet(BuildPath_out(row,col), 0, s)
}

function grid_out::SetElemI(row,col,i)
{
	app.DataSet(BuildPath_out(row,col), 0, i)
}

function grid_out::GetRecordNum()
{
	var list = app.SelectNodesXML(gridDatapath_out + "/*")
	if (list) grid_out.EventResult = list.length
}

function grid_out::PopupMenu(row, col, x, y)
{
	ShowGridPopup(grid_out, row, col, x, y)
}

function grid_out::ColClick(col)
{
	GridSort(grid_out, gridDatapath_out, col)
}

function grid_out::EndColTrack(col)
{
	m_gridColumnsChanged = true
}
