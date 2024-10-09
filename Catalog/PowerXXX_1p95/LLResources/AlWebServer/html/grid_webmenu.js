var tablePath = "webmenuItems[1]"		// path relativo della tabella
var rowTemplate = "webmenuItem"						// nome del template della riga
var gridDatapath = ""

var columns = { name: 0, ctrlType: 1, label: 2, section: 3, size: 4, format: 5, readOnly: 6, imgWidth: 7, imgHeight: 8, enumValues: 9 }
var m_columnsNodes = []

var gridErrorPos = { row: -1, col: -1 }




function InitGrid(datapath)
{
	for (var i in columns)
		m_columnsNodes.push(i)

	LoadVarsList();

	grid.AddEnum("BoolEnum", [HTMLCTRL.SELECT, "Select", HTMLCTRL.BUTTON, "Button", HTMLCTRL.RADIO, "Radio", HTMLCTRL.CHECKBOX, "Checkbox", HTMLCTRL.IMAGE, "Image", HTMLCTRL.TOGGLE_BUTTON, "Toggle button"])
	grid.AddEnum("EnumerativeEnum", [HTMLCTRL.TEXT, "Text", HTMLCTRL.SELECT, "Select", HTMLCTRL.BUTTON, "Button", HTMLCTRL.RADIO, "Radio", HTMLCTRL.IMAGE, "Image"])
	grid.AddEnum("TextOnlyEnum", [HTMLCTRL.TEXT, "Text"])
	grid.AddEnum("EmptyEnum", [-1, ""])
	grid.AddEnum("TrueFalse", [0, app.Translate('False'), 1, app.Translate("True")]);
	
	grid.AddColumn(150, 100, true,  false, egColumnType.egEdit,  0, app.Translate("Name"))
	grid.AddColumn(100, 100, false, false, egColumnType.egCombo, 0, app.Translate("Control"))
	grid.AddColumn(200, 100, false, false, egColumnType.egEdit,  0, app.Translate("Label"))
	grid.AddColumn(200, 100, false, false, egColumnType.egEdit,  0, app.Translate("Section"))
	grid.AddColumn( 60, 100, false,  true, egColumnType.egEdit,  0, app.Translate("Text size"))
	grid.AddColumn( 60, 100, false, false, egColumnType.egEdit,  0, app.Translate("Format"))
	grid.AddColumn( 60, 100, false, false, egColumnType.egCombo, 0, app.Translate("Read only"), "TrueFalse");
	grid.AddColumn( 45, 100, false,  true, egColumnType.egEdit,  0, app.Translate("Img X"))
	grid.AddColumn( 45, 100, false,  true, egColumnType.egEdit,  0, app.Translate("Img Y"))
	grid.AddColumn(250, 100, false, false, egColumnType.egEditOpt,  0, app.Translate("Enum values"))
	
	gridDatapath = datapath + tablePath
	grid.Init()
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)

	grid.EnableDrop = true
}

function grid_AddRowXML(doAssign)
{
	app.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	grid.InsertRows(1)
	
	grid.focus()
	grid.EditMode(true)
	grid.Move(grid.GetRealRow(grid.NumRows-1), columns.name)

	if (doAssign)
		Assign()
}

function grid_DeleteRowXML()
{
	grid_DeleteMultiple(grid, gridDatapath)
}


