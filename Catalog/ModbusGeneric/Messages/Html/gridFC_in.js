var tablePath_in = "FC_config[1]/FC_images_in[1]"		// path relativo della tabella
var rowTemplate = "FC_image"						// nome del template della riga

var gridDatapath_in = ""

var columns_in = { name: 0, objtype: 1, address: 2, label: 3, type: 4, dataBlock: 5 }
var m_columnsNodes_in = ["ioObject/@name", "ioObject/@objtype", "address", "label", "type", "dataBlock"]
var m_extName
var m_protocol

var gridErrorPos = { row: -1, col: -1 }

var m_rootDevice

function InitGrid_in(datapath)
{
	gridDatapath_in = datapath + tablePath_in
	
	// nodo corrente (FCxx)
	var node = app.SelectNodesXML(datapath.slice(0,-1))[0]
	// ottiene il protocol dal parent del parent (la porta, sopra il GenericModbus)
	m_protocol = node.parentNode.parentNode.getAttribute("protocol")
	// device principale (target del progetto)
	m_rootDevice  = node.selectSingleNode(XPATH_ROOTDEVICE)
	m_extName = m_rootDevice.getAttribute("ExtensionName")
	
	m_tabsMap[ tablePath_in ] = 2        // numero del tab in cui si trova la griglia
		
	grid_in.AddColumn(80,  100, true, false, egColumnType.egEdit, 0, app.Translate("Name"))
	grid_in.AddColumn(130, 100, true, false, egColumnType.egEdit, 0, app.Translate("ObjType"))
	grid_in.AddColumn( 80, 100, true, false, egColumnType.egEdit, 0, app.Translate("Address"))  //translate
	grid_in.AddColumn(100, 100, false, false, egColumnType.egEdit, 0, !m_useAlModbusStructSlaves ? app.Translate("Variable") : app.Translate("Field"));
	grid_in.AddColumn(  0, 100, true, false, egColumnType.egEdit, 0, app.Translate("Type"))  //translate
	if ( m_useAlModbusRTU )
		grid_in.AddColumn(  0, 100, true, false, egColumnType.egEdit, 0, app.Translate("DataBlock"))  //translate
	else
		grid_in.AddColumn(100, 100, true, false, egColumnType.egEdit, 0, app.Translate("DataBlock"))  //translate
//	grid_in.AddColumn(200, 100, true, false, egColumnType.egEdit, 0, app.Translate("Description"))  //translate
	
	grid_in.Init()
	
	RestoreGridSort(grid_in, gridDatapath_in)
	
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid_in, gridDatapath_in, m_columnsNodes_in)
	if (gridErrorPos.row != -1 && gridErrorPos.col != -1)
		ChangeTab(2)
}

function Assign_in()
{
	var type = grid_in.Elem(grid_in.SelectedRow, columns_in.objtype)
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, true, type)
	
	if (type != "BOOL")
		// disattiva il filtro per i non booleani (per poter mappare ad es. un DINT su due registri)
		type = ""
	
	if ( m_useAlModbusRTU )	
		AssignPLCVar(grid_in, columns_in, type, dataBlock, PLCVARASSIGN_ONLYSIMPLE, undefined, "Modbus_Vars")
	else
		AssignPLCVar(grid_in, columns_in, type, dataBlock)
}

function UnAssign_Rows_in()
{
	UnAssignPLCVars(grid_in, columns_in)
}

function AddRowXML_in( name, type )
{
	// verifica numero massimo mappature per messaggio
	var maxRows = parseInt(m_rootDevice.getAttribute("maxModbusMsgMappings"))
	if (grid_in.NumRows >= maxRows)
	{
		var msg = app.Translate("'%1' can have a maximum of %2 mapped variables for each Modbus message")
		app.PrintMessage(FormatMsg(msg, m_rootDevice.getAttribute("caption"), maxRows))
		return
	}
	
	var path = window.external.AddTemplateData(rowTemplate, gridDatapath_in, 0, false)
	window.external.DataSet( path + "/ioObject/@name", 0, name )
	window.external.DataSet( path + "/ioObject/@objtype", 0, type )
	window.external.DataSet( path + "/ioObject/@inout", 0, "in" )
	grid_in.InsertRows(1)
}

function DeleteRowXML_in()
{
	UnAssign_Rows_in()
	grid_DeleteMultiple(grid_in, gridDatapath_in)
}

