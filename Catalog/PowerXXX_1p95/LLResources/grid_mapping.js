var tablePath = "."		// path relativo della tabella
var gridDatapath = ""
var rowTemplate = ""

var columns = { id: 0, name: 1, label: 2, type: 3, dataBlock: 4, description: 5 }
var m_columnsNodes = ["@id", "@name", "label", "@type", "@db", "@description"]
var m_extName
var m_LocalIODef
var m_globalGroupName = "I/O mappings"
var gridErrorPos = { row: -1, col: -1 }

function InitGrid(datapath)
{	
	gridDatapath = datapath + tablePath
	
	// partendo dal datapath recupera il device root, il nome della sua estensione e la definizione dell'IO locale dal PCT
	var node = app.SelectNodesXML(gridDatapath)[0]
	var device  = node.selectSingleNode(XPATH_PARENTDEVICE)
	m_extName = device.getAttribute("ExtensionName")
	
	// recupera da PCT il template XML con la definizione dell'IO locale, invece di tenerlo nel PCN
	m_LocalIODef = app.CallFunction(m_extName + ".GetLocalIODef", device, m_localIODefSuffix)
		
	grid.AddColumn(  0, 100,  true,  true, egColumnType.egEdit, 0, app.Translate("ID"))
	grid.AddColumn( 80, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Name"))
	grid.AddColumn(200, 100, false, false, egColumnType.egEdit, 0, app.Translate("Variable"))
	grid.AddColumn( 60, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Type"))
	grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit, 0, app.Translate("DataBlock"))
	grid.AddColumn(400, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Description"))
	
	grid.Init()
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function Assign()
{
	var type = grid.Elem(grid.SelectedRow, columns.type)
	var dataBlock = grid.Elem(grid.SelectedRow, columns.dataBlock)
	
	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (solo la label)
	var c = { label: columns.label }
	AssignPLCVar(grid, c, type, dataBlock, PLCVARASSIGN_ONLYAUTO | PLCVARASSIGN_ONLYSIMPLE)
}

function UnAssign()
{
	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (solo la label)
	var c = { label: columns.label }
	UnAssignPLCVars(grid, c)
}
