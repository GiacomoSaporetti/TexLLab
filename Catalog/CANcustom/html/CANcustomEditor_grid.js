var GRIDNAME = "CANcustomEditor"      // nome della griglia, usato in file INI

var gridDatapath = "/devicetemplate/deviceconfig/parameters"
var rowTemplate = "par"

var columns = { index: 0, subindex: 1, label: 2, type: 3, accessType:4, defval:5, PDOMapping:6, description: 7 }
var m_columnsNodes = [ "protocol[@name='CanOpen']/@commaddr", "protocol[@name='CanOpen']/@commsubindex", "@name", "@typetarg", "option[@optid='AccessType']", "@defval", "option[@optid='PDOMapping']", "@descr" ]

// conversione da tipo di configuratore in valore numerico in enumeratore IEC
var m_parTypesToIEC = { "boolean": IECTypes.BOOL, 
						"char": IECTypes.SINT, "unsignedChar": IECTypes.USINT, 
						"short": IECTypes.INT, "unsignedShort": IECTypes.UINT, 
						"int": IECTypes.DINT, "unsignedInt": IECTypes.UDINT, 
						"float": IECTypes.REAL }

function InitGrid()
{
	// init enumeratori
	var typesEnum = [
		IECTypes.BOOL, "BOOL",
		IECTypes.SINT, "SINT",   IECTypes.USINT, "USINT", IECTypes.BYTE, "BYTE",
		IECTypes.INT,  "INT",    IECTypes.UINT,  "UINT",  IECTypes.WORD, "WORD",
		IECTypes.DINT, "DINT",   IECTypes.UDINT, "UDINT", IECTypes.DWORD, "DWORD",
		IECTypes.REAL, "REAL"
	]
	var accessTypeEnum = [
		0, "rw",
		1, "ro",
		2, "wo"
	]
	var defvalEnum = [
		0, "",
		1, "0",
		2, "$NODEID+0x000"
	]
	grid.AddEnum("typesEnum", typesEnum)
	grid.AddEnum("Boolean", [0, "False", 1, "True"]);
	grid.AddEnum("accessTypeEnum", accessTypeEnum);
	grid.AddEnum("defvalEnum", defvalEnum);
	
	// init colonne
	grid.AddColumn(100, 10, false, false, egColumnType.egEdit, 0, "Index (hex)")
	grid.AddColumn(100, 10, false, false, egColumnType.egEdit, 0, "Subindex (hex)")
	grid.AddColumn(200, 99, false, false, egColumnType.egEdit, 0, "Label")
	grid.AddColumn( 80, 10, false, false, egColumnType.egCombo, 0, "Type", "typesEnum")
	grid.AddColumn( 80, 10, false, false, egColumnType.egComboText, 0, "Access Type", "accessTypeEnum")
	grid.AddColumn(120, 10, false, false, egColumnType.egComboTextEdit, 0, "Def. value", "defvalEnum")
	grid.AddColumn( 80, 10, false,  true, egColumnType.egCombo, 0, "PDOMapping", "Boolean")
	grid.AddColumn(300, 99, false, false, egColumnType.egEdit, 0, "Description")
	
	grid.Init()
	grid.UseSlowEvents = false
	
//	GridLoadSettings(grid, GRIDNAME)
		
	// gestione evidenziamento errore
//	SearchErrorTable(grid, gridDatapath, m_columnsNodes)
	
//	RestoreGridSort(grid, gridDatapath)
}

/*function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}*/

function AddRow()
{
	// lettura contatore ipa successivo
	var nextIpa = parseInt(GetNode(m_xmldoc, gridDatapath + "/@nextIpa"))
	var parent = m_xmldoc.selectSingleNode(gridDatapath)
	var newnode = app.GetTemplateData("par")[0].cloneNode(true)
	newnode.removeAttribute("template")
	newnode.removeAttribute("version")
	newnode.setAttribute("defval", 0)
	newnode.setAttribute("descr", "")
	
	parent.appendChild(newnode)
	
	newnode.setAttribute("ipa", nextIpa)
	newnode.selectSingleNode("protocol[@name='Modbus']").setAttribute("name", "CanOpen")
	
	// sottonodo option per AccessType
	var nodeoption = m_xmldoc.createElement("option")
	nodeoption.setAttribute("optid", "AccessType")
	nodeoption.nodeTypedValue = "rw"
	newnode.appendChild(nodeoption)
	
	// sottonodo option per PDOMapping
	var nodeoption = m_xmldoc.createElement("option")
	nodeoption.setAttribute("optid", "PDOMapping")
	nodeoption.nodeTypedValue = 1
	newnode.appendChild(nodeoption)
	
	grid.InsertRows(1)
	grid.Move(grid.NumRows - 1, 0)
	
	SetNode(m_xmldoc, gridDatapath + "/@nextIpa", nextIpa + 1)
	
	SetModifiedFlag()
}

function DeleteRow()
{
	if (grid.NumRows == 0) return
	
	var selectionsArr = grid.GetSelections()
	if (selectionsArr != undefined)
	{
		var list = VBArray(selectionsArr).toArray()
		if (list.length > 0)
		{
			// ok multiselezione ON
			for (var i = list.length - 1; i >= 0; i--)
			{
				var row = list[i] + 1
				var node = m_xmldoc.selectSingleNode(gridDatapath + "/*[" + row + "]")
				node.parentNode.removeChild(node)
			}
			grid.DeleteRows(list.length)
			SetModifiedFlag()
			return
		}
	}
	
	// multiselezione OFF, linea singola
	var row = grid.SelectedRow + 1
	var node = m_xmldoc.selectSingleNode(gridDatapath + "/*[" + row + "]")
	node.parentNode.removeChild(node)
	grid.DeleteRows(1)
	SetModifiedFlag()
}

function ReloadGridData()
{
	if (grid.NumRows != 0)
		grid.DeleteRows(grid.NumRows)
		
	grid.InsertRows(GetNumRows())
}
