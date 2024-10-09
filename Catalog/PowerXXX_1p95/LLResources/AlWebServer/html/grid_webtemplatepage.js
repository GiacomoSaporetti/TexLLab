var tablePath = "webtemplateItems[1]"		// path relativo della tabella
var rowTemplate = "webtemplateItem"						// nome del template della riga
var gridDatapath = ""

var columns = { name: 0, label: 1, ctrlType: 2, note: 3, id: 4 }
var m_columnsNodes = ["name", "label", "ctrlType", "note", "@id"]

var gridErrorPos = { row: -1, col: -1 }

var m_parentDevice
var m_pageTemplate





function InitGrid(datapath)
{
	LoadVarsList();
	
	// risale al device padre
	m_parentDevice = app.SelectNodesXML(datapath + ".")[0]
	m_parentDevice = m_parentDevice.selectSingleNode(XPATH_ROOTDEVICE)
	
	// carica page template da disco per ottenere le note dei parametri
	m_pageTemplate = app.CallFunction("WebServer.LoadWebPageTemplate", app.DataGet(datapath + "@pagetemplate", 0))
	if (!m_pageTemplate)
		app.PrintMessage("ERROR loading page template !" )
	
	grid.AddEnum("controlsEnum", [HTMLCTRL.TEXT, "Text", HTMLCTRL.SELECT, "Select", HTMLCTRL.BUTTON, "Button", HTMLCTRL.IMAGE, "Image", HTMLCTRL.RADIO, "Radio", HTMLCTRL.CHECKBOX, "Checkbox"])
	
	grid.AddColumn(150, 100, true,  false, egColumnType.egEdit,  0, app.Translate("Name"))
	grid.AddColumn(200, 100, false, false, egColumnType.egEdit,  0, "Label")
	grid.AddColumn( 80, 100,  true, false, egColumnType.egCombo, 0, "Control", "controlsEnum")
	grid.AddColumn(500, 100,  true, false, egColumnType.egEdit,  0, "Note")
	grid.AddColumn(  0, 100,  true, false, egColumnType.egEdit,  0, "id")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function UnAssign()
{
	if (grid.NumRows == 0)
		return false
	
	var row = grid.SelectedRow
	grid.Elem(row, columns.name) = ""

	grid.Update(row, -1)
	return true
}
