
function grid::GetEnum(row,col)
{
	switch (col)
	{
		case columns.value:
			var type = grid.Elem( row, columns.typepar )
			if (type == TYPEPAR.BOOL)
				grid.EventResult = "BOOLenum"
			else
				// il valore numerico del typepar coincide con il nome dell'enumerativo
				grid.EventResult = type.toString()
			break
			
		case columns.form:
			var type = grid.Elem( row, columns.typepar )
			if (type == TYPEPAR.REAL)
				grid.EventResult = "formatsEnum"
			else
				grid.EventResult = "formatsEnum_Int"
			break
			
		case columns.min:
		case columns.max:
			// genera al volo enumrativo per min/max, va ricalcolato ogni volta perchè l'elenco di par/var può essere cambiato
			var list = [0, ""]
			// elenco eeprom par + status var
			var params = m_parentDevice.selectNodes("config/params/param | config/paramsRO/param")
			var par
			while (par = params.nextNode())
			{
				var name = GetNode(par, "name")
				if (name != grid.Elem(row, columns.name))   // esclude il parametro attuale
					list.push(parseInt(GetNode(par, "ipa")), name)
			}
			
			// reinserisce l'enum ogni volta
			grid.AddEnum("minMaxEnum", list)
			grid.EventResult = "minMaxEnum"
			break
	}
}

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
	if ( col == columns.addressHex )
	{
		var value = window.external.DataGet(BuildPath(row,columns.address), 0)
		var valueHex = genfuncs.toHex( parseInt(value ) )
		grid.EventResult = valueHex
	}
	else
	{
		var value = window.external.DataGet(BuildPath(row,col), 0)
		
		if (col == columns.size)
		{
			// size abilitata solo per tipo stringa
			var typepar = parseInt(grid.Elem( row, columns.typepar ))
			if (typepar == TYPEPAR.STRING)
				grid.EventResult = value
			else if (!m_isArraySupported)
				grid.EventResult = ""
			else if (parseInt(value) > 0)
				grid.EventResult = value
			else
				grid.EventResult = ""
		}
		else
			grid.EventResult = value
	}
}

function grid::GetElemI(row,col)
{
	var i = window.external.DataGet(BuildPath(row,col), 0)
	
	if (col == columns.value && !IS_PARAMS)
	{
		var type = grid.Elem(row, columns.typepar)
		if (i == "" && (type >= ENUM_BASE || type == TYPEPAR.BOOL))
			// se nessun valore di default per un enum e siamo sulle statusvar, usa valore speciale per l'enum
			i = ENUM_NO_DEFVAL
	}
	
	grid.EventResult = i
}

function grid::SetElemS(row,col,s)
{
	if (col == columns.ipa)
	{
		if (!CheckIPARange(parseInt(s)))
		{
			grid.EventResult = false
			return
		}
		
		// cambio di ipa, effettua la modifica anche sui menu che contengono il param in questione
		var oldipa = grid.elem(row, columns.ipa)
		if (oldipa != s)
			ChangeParamIPA(oldipa, s)
	}
	else if (col == columns.name)
	{
		var oldname = grid.elem(row, columns.name)
		if ( !ChangeParamName(oldname, s, row) )
		{
			grid.EventResult = false
			return
		}
	}
	else if (col == columns.address || col == columns.addressHex)
	{
		// verifica validità address
		if (s == "" || isNaN(parseInt(s)) || !CheckAddressRange(parseInt(s)))
		{
			grid.EventResult = false
			return
		}
		
		s = parseInt(s)
	}
	else if (col == columns.size)
	{
		if (s == "")
		{
			if (!m_isArraySupported)
			{
				grid.EventResult = false
				return
			}
			else
			{
				var typepar = parseInt(grid.Elem( row, columns.typepar ))
				if (typepar == TYPEPAR.STRING)
				{
					grid.EventResult = false
					return
				}
				else
				{
					s = 0
				}
			}
		}
	}
	else if (col == columns.value)
	{
		var typepar = grid.Elem(row, columns.typepar)
		if (s == "")
		{
			if (IS_PARAMS && typepar != TYPEPAR.STRING)
				return    // per gli EEPROM parameters non permette mai default vuoto (tranne per le stringhe)
		}
		else
		{
			//se è un tipo numerico accetto solo numerico
			if(typepar != TYPEPAR.STRING && !isNumber(s))
				return
		}
	}
	else if (col == columns.label)
	{
		if (s.indexOf(" ") != -1)
		{
			grid.EventResult = false
			return
		}
	}
	
	if ( col == columns.ipa )
	{
		//	aggiorna ipa
		window.external.DataSet(BuildPath(row,col), 0, s)
	}
	else if ( col == columns.addressHex )
	{
		//	aggiorna address
		window.external.DataSet(BuildPath(row,columns.address), 0, s)
		grid.Update(row,columns.address)
	}
	else if ( col == columns.address )
	{
		//	aggiorna address
		window.external.DataSet(BuildPath(row,col), 0, s)
		
		//	aggiorna address hex
		grid.Update(row,columns.addressHex)
	}
	else
	{
		window.external.DataSet(BuildPath(row,col), 0, s)
	}
}

function GetTypeParName(type)
{
	var typename
	for (typename in TYPEPAR)
		if (TYPEPAR[typename] == type)
			return typename
}

function GetFirstEnumValue(enumId)
{
	var nodelist = app.SelectNodesXML( datapath.value + "../enums/enum[@id = " + enumId + "]/enum_value/value" )
	if (nodelist && nodelist.length != 0)
		return parseInt(nodelist[0].text)
}

function grid::SetElemI(row,col,i)
{
	var oldType
	if( col == columns.typepar )
	{
		oldType = grid.elem( row, col )
		if (oldType == i)
			return  // nessuna modifica, esce subito
	}
	else if (col == columns.value && !IS_PARAMS)
	{
		var type = grid.Elem(row, columns.typepar)
		if (i == ENUM_NO_DEFVAL && (type >= ENUM_BASE || type == TYPEPAR.BOOL))
			// se specificato defval vuoto per un enum nelle statusvar, salva stringa vuota
			i = ""
	}

	window.external.DataSet(BuildPath(row,col), 0, i)
	
	if( col == columns.typepar )
	{
		if (IS_PARAMS || !ParseBoolean(grid.Elem(row, columns.readonly)))
		{
			if (i >= ENUM_BASE)
			{
				// se si seleziona un tipo enum, forza il default al primo valore dell'enum
				grid.elem( row, columns.value ) = GetFirstEnumValue(i - ENUM_BASE)
				grid.update( row, columns.value )
			}
			else if (i == TYPEPAR.BOOL || oldType == TYPEPAR.BOOL)
			{
				// se si seleziona un bool o il precedente era bool mette il default a False/0
				grid.elem( row, columns.value ) = 0
				grid.update( row, columns.value )
			}
			else if (oldType >= ENUM_BASE)
			{
				// se il vecchio tipo è un enum mette a zero il default
				grid.elem( row, columns.value ) = 0
				grid.update( row, columns.value )
			}
			else
			{
				var defaultValue = grid.elem( row, columns.value )
				
				// se il defaultvalue non è più valido con il nuovo tipo lo resetta a 0
				if (!app.CallFunction("script.CheckValueWithNewType", defaultValue, GetTypeParName(oldType), GetTypeParName(i)))
				{
					grid.elem( row, columns.value ) = 0
					grid.update( row, columns.value )
				}
			}
		}
		
		// annullamento formato
		grid.Elem(row, columns.form) = ""
		grid.Update(row, columns.form)
		
		// per tipi bool, string, ed enumerativi resetta min e max
		if (i == TYPEPAR.STRING || i == TYPEPAR.BOOL || i >= ENUM_BASE)
		{
			grid.Elem(row, columns.min) = ""
			grid.Update(row, columns.min)
			grid.Elem(row, columns.max) = ""
			grid.Update(row, columns.max)
		}
		
		if (i == TYPEPAR.STRING)
		{
			// se impostato tipo stringa forza anche type targ di conseguenza
			grid.Elem(row, columns.typetarg) = "STRING"
			grid.Update(row, columns.typetarg)
			grid.Elem(row, columns.size) = 31;
		}
		else if (oldType == TYPEPAR.STRING)
			grid.Elem(row, columns.size) = 0;
		
		// refresh size
		grid.Update(row, columns.size)
		
		// se si cambia il typepar da un tipo enum a un tipo standard (o viceversa) oppure il precedente era bool:
		// per tutti i parametri inseriti in menu web riporta il tipo a "text"
		if (app.CallFunction(m_extName + ".IsStandardTypePar", oldType) != app.CallFunction(m_extName + ".IsStandardTypePar", i) ||
		    oldType == TYPEPAR.BOOL)
		{
			var ipa = grid.elem(row, columns.ipa)
			var nodelist = m_parentDevice.selectNodes(".//webmenuItems/webmenuItem[ipa = '" + ipa + "']/ctrlType")
			while (node = nodelist.nextNode())
				node.text = 0
		}
	}
	else if (col == columns.readonly && i != 0)
	{
		// se parametro impostato r/o svuota min,max,defval
		app.DataSet(BuildPath(row, columns.min), 0, "")
		app.DataSet(BuildPath(row, columns.max), 0, "")
		app.DataSet(BuildPath(row, columns.value), 0, "")
		grid.Update(row, -1)
	}
}

function grid::GetRecordNum()
{
	var list = window.external.SelectNodesXML(gridDatapath + "/*")
	if (list) grid.EventResult = list.length
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::GetColType(row, col)
{
	var typepar = parseInt(grid.Elem( row, columns.typepar ))
	if( col == columns.value )
	{
		if( typepar == TYPEPAR.BOOL || typepar >= ENUM_BASE )
			grid.EventResult = egColumnType.egCombo
		else
			grid.EventResult = egColumnType.egEdit
	}
}

// genera stringa per drag&drop
function grid::GetDataSource(row,col)
{
	grid.EventResult = CreateDataSourceString(grid)
}

function grid::AllowEdit(row,col)
{
	var typepar = parseInt(grid.Elem( row, columns.typepar ))
	
	if (columns.readonly != undefined)
		var ro = parseInt(grid.Elem( row, columns.readonly ))
	else
		var ro = false
		
	if (col == columns.form)
		// disabilita le colonne format per tipi enumerativi (bool compreso) e stringhe
		grid.EventResult = (typepar != TYPEPAR.STRING && typepar != TYPEPAR.BOOL && typepar < ENUM_BASE)
	else if (col == columns.min || col == columns.max)
		// disabilita le colonne min,max per tipi enumerativi (bool compreso) e stringhe, o parametri readonly
		grid.EventResult = (typepar != TYPEPAR.STRING && typepar != TYPEPAR.BOOL && typepar < ENUM_BASE && !ro)
	else if (col == columns.value)
		// disabilita le colonne default value se readonly
		grid.EventResult = !ro
	else if (col == columns.size)
		// size abilitata solo per tipo stringa
		grid.EventResult = m_isArraySupported || (typepar == TYPEPAR.STRING)
	else if (col == columns.typetarg)
		// typetarg disabilitato per tipi stringa
		grid.EventResult = (typepar != TYPEPAR.STRING)
	else
		grid.EventResult = true
}

// funzione callback speciale che restituisce il nuovo valore per le celle durante l'operazione di paste
function PasteGetNewValue(row, col, oldValue)
{
	if (col == columns.ipa)
		return FindFreeIPA()
	else if (col == columns.address)
	{
		var size = app.CallFunction("parameters.GetModbusObjectSizeFromIEC", GetTypeParName(columns.typepar), columns.size)
		return app.CallFunction(m_extName + ".FindFreeAddress", m_addressRange, size)
	}
	else if (col == columns.typepar && oldValue >= ENUM_BASE)
	{
		// se si sta incollando un par enumerativo, verifica che tale enum (verificandone l'id, che è ciò che viene copiato) esista nel progetto locale
		// verifica anche che l'enum abbia almeno un valore definito, altrimenti non è valido
		var node = m_parentDevice.selectSingleNode("config/enums/enum[@id = " + (oldValue-ENUM_BASE) + "]/enum_value | config/sysenums/enum[@id = " + (oldValue-ENUM_BASE) + "]/enum_value")
		if (node)
			return oldValue
		else
			return 0  // se enum non esiste, il nuovo parametro sarà 'signed 16'
	}
	else if (col == columns.name)
		return FindFreeName(oldValue)
	else
		return oldValue
}

function grid::PopupMenu(row, col, x, y)
{
	if (row >= 0)
		app.TempVar("Refactoring_varName") = grid.Elem(row, columns.name)
	
	var menuName = (row == -1) ? "menu_GridColumns" : "menu_gridRefactorPopup"
	ShowGridPopup(grid, row, col, x, y, gridDatapath, rowTemplate, menuName, columns, PasteGetNewValue)
	
	if (row >= 0)
		app.TempVar("Refactoring_varName") = null
}

function grid::SpecialEvent(id, param)
{
	GridSpecialEvent(id, param, grid, gridDatapath, rowTemplate, columns, PasteGetNewValue)
}
