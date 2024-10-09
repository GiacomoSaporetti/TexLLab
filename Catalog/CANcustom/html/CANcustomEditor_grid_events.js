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
	var value = GetNode(m_xmldoc, BuildPath(row,col))
	
	if ( col == columns.defval )
	{
		if ( value.length > 0 && !isNaN( value ) )
		{
			if ( chkHexMode.checked )
				value = "0x" + parseInt( value ).toString( 16 )
			else
				value = parseInt( value )
		}
	}
	else if ( col == columns.index || col == columns.subindex )
	{
		if ( value.length > 0 && !isNaN( value ) )
		{
			value = parseInt( value ).toString( 16 )
		}
	}
	
	grid.EventResult = value
}

function grid::GetElemI(row,col)
{
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
	else
		grid.EventResult = value
}

function grid::SetElemS(row,col,s)
{
	if ( col == columns.defval )
	{
		if ( s != "" )
		{
			if ( isNaN( s ) && s.substr( 0, 7 ) != "$NODEID" )
				s = ""
			else if ( !isNaN( s ) )
				s = parseInt( s )
		}
	}
	else if ( col == columns.index || col == columns.subindex )
	{
		if ( s != "" )
		{
			if ( s.substr( 0, 2 ) != "0x" )
				s = "0x" + s
			
			if ( isNaN( s ) )
				s = ""
			else
				s = parseInt( s )
		}
	}
	
	SetNode(m_xmldoc, BuildPath(row,col), s)
	
	SetModifiedFlag()
}

function grid::SetElemI(row,col,i)
{
	SetModifiedFlag()
	
	if (col == columns.type)
	{
		var hex = false
		
		if (i == IECTypes.BOOL)
		{
			i = "boolean"
		}
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
	}

	SetNode(m_xmldoc, BuildPath(row,col), i)
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
	ShowGridPopup(grid, row, col, x, y, gridDatapath, rowTemplate, "gridPopup")
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, param)
{
	// TODO bug in copia/incolla
	//GridSpecialEvent(id, param, grid, gridDatapath, rowTemplate)
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}
