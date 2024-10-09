function grid::ClickElem(row,col)
{
	grid.EditMode(true)
}

function BuildPath(row,col)
{
	return gridDatapath + "/par[" + (row+1) + "]/" + m_columnsNodes[col]
}

function grid::GetElemS(row,col)
{
	grid.EventResult = GetNode(m_xmldoc, BuildPath(row,col))
}

// ritorna il tipo modbus calcolato a partire da type+readonly
function GetModbusType(row)
{
	var type = GetNode(m_xmldoc, BuildPath(row,columns.type))
	var readOnly = (GetNode(m_xmldoc, BuildPath(row,columns.readOnly)) == "true")
	
	switch (type)
	{
		case "digitalInput":	return MODBUSTYPES.DISCRETEINPUT;  // per forza ro
		case "digitalOutput":	return MODBUSTYPES.COIL;           // per forza rw
		case "boolean":			return readOnly ? MODBUSTYPES.INPUTREG1 : MODBUSTYPES.HOLDINGREG1;
		case "char":			
		case "unsignedChar":	return readOnly ? MODBUSTYPES.INPUTREG8 : MODBUSTYPES.HOLDINGREG8
		case "short":			
		case "unsignedShort":	return readOnly ? MODBUSTYPES.INPUTREG16 : MODBUSTYPES.HOLDINGREG16
		case "int":				
		case "unsignedInt":		
		case "float":			return readOnly ? MODBUSTYPES.INPUTREG32 : MODBUSTYPES.HOLDINGREG32
	}
}

function grid::GetElemI(row,col)
{
	if (col == columns.modbusType)
	{
		grid.EventResult = GetModbusType(row)
		return
	}
	
	var value = GetNode(m_xmldoc, BuildPath(row,col))
	
	if (col == columns.type)
	{
		// verifica se hex controllato il formato se %x
		var hex = GetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@form").toLowerCase() == "%x"
		
		// conversione da tipo configuratore a valore numerico nell'enum IEC
		value = m_parTypesToIEC[value]

		// se hex sostituisce col tipo IEC corretto
		if (hex && value == IECTypes.USINT)
			grid.EventResult = IECTypes.BYTE
		else if (hex && value == IECTypes.UINT)
			grid.EventResult = IECTypes.WORD
		else if (hex && value == IECTypes.UDINT)
			grid.EventResult = IECTypes.DWORD
		else
			grid.EventResult = value
	}
	else if (col == columns.readOnly)
		// conversione da no/yes a 0/1
		grid.EventResult = (value == "true" ? 1 : 0)
	else
		grid.EventResult = value
}

function grid::SetElemS(row,col,s)
{
	if (s == grid.Elem(row,col))
		return
	
	SetNode(m_xmldoc, BuildPath(row,col), s)

	// se cambio l'address aggiorno anche le colonne in modbusMapping (input e output) e sendParams che usano il parametro che sto aggiornando
	if (col == columns.address) {
		gridOutput.Update(-1, gridInputOutputColumns.address);
		gridInput.Update(-1, gridInputOutputColumns.address);
		gridParametrization.Update(-1, gridParametrizationColumns.address);
	}
	else if (col == columns.label) {
		gridOutput.Update(-1, gridInputOutputColumns.parameter);
		gridInput.Update(-1, gridInputOutputColumns.parameter);
		gridParametrization.Update(-1, gridParametrizationColumns.parameter);
	}

	SetModifiedFlag()
}

function grid::SetElemI(row,col,i)
{
	if (i == grid.Elem(row,col))
		return

	if (col == columns.type)
	{
		var hex = false
		
		if (i == IECTypes.BOOL)
			// gestione speciale per BOOL: se r/o è discrete input, se r/w coil
			i = grid.Elem(row, columns.readOnly) ? "digitalInput" : "digitalOutput"
		else if (i == IECTypes.BYTE)
		{
			i = "unsignedChar"
			hex = true
		}
		else if (i == IECTypes.WORD)
		{
			i = "unsignedShort"
			hex = true
		}
		else if (i == IECTypes.DWORD)
		{
			i = "unsignedInt"
			hex = true
		}
		else
			// conversione da valore numerico enum IEC in tipo configuratore
			for (var type in m_parTypesToIEC)
				if (m_parTypesToIEC[type] == i)
				{
					i = type
					break
				}
		
		// setta anche il typepar oltre al typetarg
		SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@typepar", i)
		SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@form", hex ? "%X" : "")
		
		// propaga il cambio del tipo anche ai nodi in modbusMapping (input e output) e sendParams che usano il parametro che sto aggiornando
		var ipaToUpdate = GetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@ipa");

		var updateQry = gridInputDatapath + "/" + rowTemplateInputOutput + genfuncs.FormatMsg("[ioObject/@objectIndex=%1]", ipaToUpdate) +
					" | " + gridOutputDatapath + "/" + rowTemplateInputOutput + genfuncs.FormatMsg("[ioObject/@objectIndex=%1]", ipaToUpdate) +
					" | " + gridParametrizationDatapath + "/" + rowTemplateParametrization + genfuncs.FormatMsg("[address=%1]", ipaToUpdate);

		var updateNodes = m_xmldoc.selectNodes(updateQry);
		var updateNode;
		while (updateNode = updateNodes.nextNode()) {
			var query = (updateNode.nodeName == "modbusMapping") ? "ioObject/@objtype" : "type";

			SetNode(updateNode, query, GetParTypeString(i, hex ? "%X" : ""));
		}

		grid.Update(row, columns.modbusType)
		gridOutput.Update(-1, gridInputOutputColumns.type)
		gridInput.Update(-1, gridInputOutputColumns.type)
		gridParametrization.Update(-1, gridParametrizationColumns.type)
	}
	else if (col == columns.readOnly)
	{
		if (grid.Elem(row, columns.type) == IECTypes.BOOL)
		{
			// gestione speciale per BOOL: se r/o è discrete input, se r/w coil
			SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@typetarg", i ? "digitalInput" : "digitalOutput")
			SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@typepar",  i ? "digitalInput" : "digitalOutput")
		}
		
		// conversione da 0/1 a yes/no
		i = (i ? "true" : "false")
		grid.Update(row, columns.modbusType)
	}
	else if (col == columns.modbusType)
	{
		// cambio di modbusType: setta type e readonly di conseguenza, il dato "modbusType" in sè non esiste ma è calcolato dagli altri
		var type, readOnly
		switch (i)
		{
			case MODBUSTYPES.DISCRETEINPUT:	type = "digitalInput"; readOnly = true; break
			case MODBUSTYPES.COIL:			type = "digitalOutput"; readOnly = false; break
			case MODBUSTYPES.INPUTREG8:		type = "unsignedChar"; readOnly = true; break
			case MODBUSTYPES.HOLDINGREG8:	type = "unsignedChar"; readOnly = false; break
			case MODBUSTYPES.INPUTREG16:	type = "short"; readOnly = true; break
			case MODBUSTYPES.HOLDINGREG16:	type = "short"; readOnly = false; break
			case MODBUSTYPES.INPUTREG32:	type = "int"; readOnly = true; break
			case MODBUSTYPES.HOLDINGREG32:	type = "int"; readOnly = false; break
			case MODBUSTYPES.INPUTREG1:		type = "boolean"; readOnly = true; break
			case MODBUSTYPES.HOLDINGREG1:	type = "boolean"; readOnly = false; break
		}
		SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@typetarg", type)
		SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@typepar", type)
		SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@readonly", readOnly ? "true" : "false")
		SetNode(m_xmldoc, gridDatapath + "/par[" + (row+1) + "]/@form",  "")
		grid.Update(row, -1)
		SetModifiedFlag();
		return
	}
	
	SetNode(m_xmldoc, BuildPath(row,col), i)

	SetModifiedFlag();
}

function GetNumRows()
{
	var list = m_xmldoc.selectNodes(gridDatapath + "/*")
	if (list) return list.length
}

function grid::GetRecordNum()
{
	grid.EventResult = GetNumRows()
}

function grid::PopupMenu(row, col, x, y)
{
	var params = {
		grid:grid, row:row, col:col, datapath:gridDatapath, rowTemplate:rowTemplate, 
		getNewValueFunc:PasteGetNewValue, selectNodesFunc:SelectNodes, addTemplateDataFunc:AddTemplateData, deleteRowFunc:OnCutDeleteRow
	}
	ShowGridPopupOpt("ModbusCustomEditor_gridPopup", x, y, params);
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, eventparam)
{
	var params = {
		grid:grid, datapath:gridDatapath, rowTemplate:rowTemplate, 
		getNewValueFunc:PasteGetNewValue, selectNodesFunc:SelectNodes, addTemplateDataFunc:AddTemplateData, deleteRowFunc:OnCutDeleteRow
	}
	GridSpecialEventOpt(id, eventparam, params)
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}
