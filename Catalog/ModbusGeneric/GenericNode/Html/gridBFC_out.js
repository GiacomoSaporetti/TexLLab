var tablePath_out = "config/images_out[1]"		// path relativo della tabella
var rowTemplate = "FC_image"						// nome del template della riga

var gridDatapath_out = ""

var columns_out = { name: 0, objtype: 1, address: 2, label: 3, type: 4, dataBlock: 5 }
var m_columnsNodes_out = ["ioObject/@name", "ioObject/@objtype", "address", "label", "type", "dataBlock"]
var m_extName
var m_protocol

var gridErrorPos = { row: -1, col: -1 }

function InitGrid_out(datapath)
{
	gridDatapath_out = datapath + tablePath_out
	
	// nodo corrente (BFCxx)
	var node = app.SelectNodesXML(datapath.slice(0,-1))[0];
	// ottiene il protocol dal parent (la porta, sopra il BFC)
	m_protocol = node.parentNode.getAttribute("protocol")
	var device  = node.selectSingleNode(XPATH_ROOTDEVICE)
	m_extName = device.getAttribute("ExtensionName")
	
	m_tabsMap[ tablePath_out ] = 2        // numero del tab in cui si trova la griglia
		
	grid_out.AddColumn(80,  100, true, false, egColumnType.egEdit, 0, app.Translate("Name"))
	grid_out.AddColumn(130, 100, true, false, egColumnType.egEdit, 0, app.Translate("ObjType"))
	grid_out.AddColumn( 80, 100, true, false, egColumnType.egEdit, 0, app.Translate("Address"))  //translate
	grid_out.AddColumn(100, 100, false, false, egColumnType.egEdit, 0, app.Translate("Label"))  //translate
	grid_out.AddColumn(  0, 100, true, false, egColumnType.egEdit, 0, app.Translate("Type"))  //translate
	if ( m_useAlModbusRTU )
		grid_out.AddColumn(  0, 100, true, false, egColumnType.egEdit, 0, app.Translate("DataBlock"))  //translate
	else
		grid_out.AddColumn(100, 100, true, false, egColumnType.egEdit, 0, app.Translate("DataBlock"))  //translate
	
	grid_out.Init()
	
	RestoreGridSort(grid_out, gridDatapath_out)
	
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid_out, gridDatapath_out, m_columnsNodes_out)
}

function Assign_out()
{
	var type = grid_out.Elem(grid_out.SelectedRow, columns_out.objtype)
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, false, type)
	
	if (type != "BOOL")
		// disattiva il filtro per i non booleani (per poter mappare ad es. un DINT su due registri)
		type = ""

	if ( m_useAlModbusRTU )	
		AssignPLCVar(grid_out, columns_out, type, dataBlock, PLCVARASSIGN_ONLYAUTO | PLCVARASSIGN_ONLYSIMPLE, undefined, "Modbus_Vars")
	else
		AssignPLCVar(grid_out, columns_out, type, dataBlock)
}

function UnAssign_Rows_out()
{
	UnAssignPLCVars(grid_out, columns_out)
}

function AddRowXML_out( name, type )
{
	var path = window.external.AddTemplateData(rowTemplate, gridDatapath_out, 0, false)

	window.external.DataSet( path + "/ioObject/@name", 0, name )
	window.external.DataSet( path + "/ioObject/@objtype", 0, type )
	window.external.DataSet( path + "/ioObject/@inout", 0, "out" )
	grid_out.InsertRows(1)
}

function DeleteRowXML_out()
{
	UnAssign_Rows_out()
	grid_DeleteMultiple(grid_out, gridDatapath_out)
}

