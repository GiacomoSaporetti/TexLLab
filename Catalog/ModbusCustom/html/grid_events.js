
/*function grid::Validate(row,col,value)
{
	grid.EventResult = ValidateColumnValue(grid, columns, row, col, value)
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
	var value = app.DataGet(BuildPath(row,col), 0)
	
	if (col == columns.parAddress)
	{
		// nel xml c'è l'ipa, ma visualizza l'indirizzo modbus
		var par = m_deviceParamsMap[value]
		value = par ? par.commIndex : ""
	}
	
	grid.EventResult = value
}

function grid::GetElemI(row,col)
{
	grid.EventResult = app.DataGet(BuildPath(row,col), 0)
}

function grid::SetElemS(row,col,s)
{
	if (col == columns.label && !m_disableModifyPLCVarAssigment && !m_useAlModbusStructSlaves)
	{
		var type = grid.Elem(row, columns.parType)
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, (m_inout == "in"), type)

		if ( m_useAlModbusRTU )
		{
			s = ModifyPLCVarAssigment(grid, columns, s, type, PLCVARTYPES_SAMESIZE, dataBlock, undefined, "Modbus_Vars")
		}
		else
		{
			// su LLExec non è previsto un gruppo specifico per le mappature
			if ( m_inout == "in" || m_inout == "out" )
			{
				s = ModifyPLCVarAssigment(grid, columns, s, type, PLCVARTYPES_SAMESIZE, dataBlock)
			}
			else
			{
				// per inout permette anche creazione di var retain su db (richiesta GetIODataBlockName che supporta tale feature)
				var dataBlockRetain = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, false, type, true /*retain*/)
				s = ModifyPLCVarAssigment(grid, columns, s, type, PLCVARTYPES_SAMESIZE, dataBlock, PLCVARASSIGN_ALLOWRETAIN, undefined /*group*/, dataBlockRetain )
			}
		}

		if (!s)
		{
			grid.EventResult = false
			return
		}
	}
	else if (col == columns.label && m_useAlModbusStructSlaves)
	{
		// label diventa nome del campo della struct, si assicura di normalizzarlo ora
		if (s != "")
			s = app.CallFunction("common.NormalizeName", s);
	}
	else if (col == columns.oneshot && !m_disableModifyPLCVarAssigment)
	{
		var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, false, 'BOOL')
	
		var c = { label: columns.oneshot }
		if ( m_useAlModbusRTU )
		{
			s = ModifyPLCVarAssigment(grid, c, s, 'BOOL', PLCVARTYPES_FIXED, dataBlock, undefined, "Modbus_Vars")
		}
		else
		{
			s = ModifyPLCVarAssigment(grid, c, s, 'BOOL', PLCVARTYPES_FIXED, dataBlock)
		}
		
		if (!s)
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
}

function grid::GetEnum(row,col)
{
	switch (col)
	{
		case columns.value:
		{
			grid.EventResult = GetEnum( row )
			break
		}
	}
}

function grid::GetColType(row,col)
{
	if( col == columns.value )
	{
		if ( !GetEnum( row ) )
			grid.EventResult = egColumnType.egEdit
		else
			grid.EventResult = egColumnType.egCombo
	}
}

function grid::GetRecordNum()
{
	var list = app.SelectNodesXML(gridDatapath + "/*")
	if (list) grid.EventResult = list.length
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}

function grid::OptionClick(row,col)
{
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, false, 'BOOL')
	
	var c = { label: columns.oneshot }
	AssignPLCVar(grid, c, "BOOL", dataBlock)
}

function compareByAddress(a,b) {
  if (a.address < b.address)
     return -1;
  if (a.address > b.address)
    return 1;
  return 0; 
 }
