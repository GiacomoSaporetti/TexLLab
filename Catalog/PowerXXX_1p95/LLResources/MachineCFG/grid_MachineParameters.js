var tablePath = "."		// path relativo della tabella
var gridDatapath = ""
var rowTemplate = ""

var columns = {};
var m_columnsNodes = [];


var m_extName
var m_machineConfig
var gridErrorPos = { row: -1, col: -1 }

function InitGrid(datapath)
{	
	columns = { pageNumber: 0, uniqueID: 1, value: 2, descr: 3 }
	m_columnsNodes = ["pageNumber", "uniqueID", "value", "descr"]
	gridDatapath = datapath + tablePath
	
	// partendo dal datapath recupera il device root, il nome della sua estensione e la definizione dell'IO locale dal PCT
	var node = app.SelectNodesXML(gridDatapath)[0]
	var device  = node.selectSingleNode(XPATH_PARENTDEVICE)
	m_extName = device.getAttribute("ExtensionName")
		
	grid.AddColumn(100, 100,  true,  true,  egColumnType.egEdit, 0, app.Translate("Page Number"))
	grid.AddColumn(100, 100,  true,  true,  egColumnType.egEdit, 0, app.Translate("ID"))
	grid.AddColumn(200, 100,  false, false, egColumnType.egMix,  0, app.Translate("Value"))
	grid.AddColumn(300, 100,  true,  false, egColumnType.egEdit, 0, app.Translate("Description"))
	
	// aggiunta enumerativi
	var nodelist = node.selectNodes("//machineParameter/enumValues[enum_value]")
	while (node = nodelist.nextNode())
	{
		var enumValuesList = node.selectNodes("enum_value")
		var enumsValues = []
		while (enumValuesNode = enumValuesList.nextNode())
		{
			var value = parseInt(genfuncs.GetNode(enumValuesNode, "value"))
			var descr = genfuncs.GetNode(enumValuesNode, "descr")
			enumsValues.push(value, descr)
		}
		
		var uniqueID = genfuncs.GetNode(node.parentNode, "uniqueID")
		grid.AddEnum("enum_" + uniqueID, enumsValues)
	}
	
	grid.Init()
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}


function InitGridAlert(datapath)
{	
	columns = {  uniqueID: 0, descr: 1 }
	m_columnsNodes =[ "uniqueID", "descr"]

	gridDatapath = datapath + tablePath

	// partendo dal datapath recupera il device root, il nome della sua estensione e la definizione dell'IO locale dal PCT
	var node = app.SelectNodesXML(gridDatapath)[0]
	var device  = node.selectSingleNode(XPATH_PARENTDEVICE)
	m_extName = device.getAttribute("ExtensionName")
		
	//grid.AddColumn(100, 100,  true,  true,  egColumnType.egEdit, 0, app.Translate("languageID"))
	grid.AddColumn(100, 100,  true,  true,  egColumnType.egEdit, 0, app.Translate("ID"))
	grid.AddColumn(300, 100,  true, false, egColumnType.egEdit,  0, app.Translate("Message"))
	
	// aggiunta enumerativi
	/*var nodelist = node.selectNodes("//messageAlerts/enumValues[enum_value]")
	while (node = nodelist.nextNode())
	{
		var enumValuesList = node.selectNodes("enum_value")
		var enumsValues = []
		while (enumValuesNode = enumValuesList.nextNode())
		{
			var value = parseInt(genfuncs.GetNode(enumValuesNode, "value"))
			var descr = genfuncs.GetNode(enumValuesNode, "descr")
			enumsValues.push(value, descr)
		}
		
		var uniqueID = genfuncs.GetNode(node.parentNode, "uniqueID")
		grid.AddEnum("enum_" + uniqueID, enumsValues)
	}*/
	
	grid.Init()
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}