var GRIDNAME = "CANGenericSdoScheduling"      // nome della griglia, usato in file INI
var tablePath = "CANgeneric_config[1]/SDOscheduling[1]"		// path relativo della tabella
var rowTemplate = "SDOscheduled"

var gridDatapath = ""

var columns
var m_columnsNodes
var m_device
var m_extName

var m_globalGroupName = "CANopen SDO scheduling"

function InitGrid(datapath)
{	
	grid.AddEnum("ReadWrite", [0, "Read", 1, "Write", 2, "Read/Write"]);
	
	if ( m_SDOSchedulingSupportedVersion == SDO_SCHEDULING_VER_1 )
	{
		columns = { objectname: 0, index: 1, subindex: 2, objtype: 3, label: 4, direction: 5, timeout: 6 }
		m_columnsNodes = ["ioObject/@name", "ioObject/@objectIndex", "ioObject/@objectSubIndex", "ioObject/@objtype", "label", "direction", "timeout"]
	}
	else if ( m_SDOSchedulingSupportedVersion == SDO_SCHEDULING_VER_2 )
	{
		columns = { objectname: 0, index: 1, subindex: 2, objtype: 3, label: 4, direction: 5, oneshot: 6, polling: 7, timeout: 8 }
		m_columnsNodes = ["ioObject/@name", "ioObject/@objectIndex", "ioObject/@objectSubIndex", "ioObject/@objtype", "label", "direction", "oneshot", "polling", "timeout"]
	}
	
	grid.AddColumn(300, 100, true,  false, egColumnType.egEdit,  0, "Object Name")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "Index")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "SubIndex")
	grid.AddColumn(80, 100, true,  false,  egColumnType.egEdit, 0, "Type")
	grid.AddColumn(200, 100, false, false,  egColumnType.egEdit,  0, "Label")
	grid.AddColumn(80, 100, false,  true, egColumnType.egCombo, 0, "Direction", "ReadWrite")
	
	if ( m_SDOSchedulingSupportedVersion >= SDO_SCHEDULING_VER_2 )
	{
		grid.AddColumn(200, 100, false, false,  egColumnType.egEditOpt,  0, "Oneshot")
		grid.AddColumn(80, 100, false, false,  egColumnType.egEdit,  0, "Polling time")
	}
	grid.AddColumn(80, 100, false, false,  egColumnType.egEdit,  0, "Timeout")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	grid.UseSlowEvents = true
	
	GridLoadSettings(grid, GRIDNAME)
		
	// gestione evidenziamento errore
	SearchErrorTable(grid, gridDatapath, m_columnsNodes)

	RestoreGridSort(grid, gridDatapath)
	
	m_device = app.SelectNodesXML(datapath + ".")[0]
	// device radice e sua estensione
	var rootDevice  = m_device.selectSingleNode(XPATH_ROOTDEVICE)
	m_extName = rootDevice.getAttribute("ExtensionName")
}

function grid_AddRowXML()
{
	window.external.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	grid.InsertRows(1)
}

function grid_DeleteRowXML()
{
	var c = { label: columns.label }
	UnAssignPLCVars(grid, c)
	
	if ( m_SDOSchedulingSupportedVersion >= SDO_SCHEDULING_VER_2 )
	{
		var c = { label: columns.oneshot }
		UnAssignPLCVars(grid, c)
	}
	
	grid_DeleteMultiple(grid, gridDatapath)
}

var FLAG_NO_RO = 1
var FLAG_NO_WO = 2
var FLAG_ONLY_PDOMAPPING = 4

function CANAddRow()
{
	// estrae il nodeName del nodo attivo (quello che stiamo configurando)
	var nodes = window.external.SelectNodesXML(datapath.value.slice(0, -1))
	if (nodes && nodes.length != 0)
		var id = nodes[0].nodeName
	else
		return
	
	// lista completa di tutti gli oggetti CAN
	var devinfo = app.CallFunction("CANgeneric.GetCANgenericDeviceInfo", id)
	if (!devinfo) return
	
	app.TempVar("newVar_showSplitBits") = false
	app.OpenWindow("newVar_CAN", "Set CAN object to map", gridDatapath + "/*")	
	var item = app.TempVar("newVar_item")
	
	// aggiunge una riga singola
	if ( item != undefined )
	{
		grid_AddRowXML()
		var row = grid.NumRows() - 1
		
		SetRowValues(row, item, devinfo.granularity, false)
		grid.Update(row, -1)
	}
}



function SetRowValues(row, par)
{
	grid.Elem(row, columns.objectname) = par.name
	grid.Elem(row, columns.index) = par.index
	grid.Elem(row, columns.subindex) = par.subindex
	grid.Elem(row, columns.objtype) = par.typeIEC
}

function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}


function Assign()
{
	var type = grid.Elem(grid.SelectedRow, columns.objtype)
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", false, type)
	
	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (no size)
	var c = { label: columns.label, type: columns.type, dataBlock: columns.dataBlock }
	
	AssignPLCVar(grid, c, type, dataBlock)
}

function UnAssign()
{
	var type = grid.Elem(grid.SelectedRow, columns.objtype)
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", false, type)

	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (no size)
	var c = { label: columns.label, type: columns.type, dataBlock: columns.dataBlock }
	
	UnAssignPLCVars(grid, c, dataBlock !== undefined)
}
