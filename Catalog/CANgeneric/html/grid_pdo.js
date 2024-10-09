// tablePath è definito nell'html padre
// IO_INOUT è definito nell'html padre
// VARSLIST_FLAGS è definito nell'html padre


var GRIDNAME = "CANPDO"      // nome della griglia, usato in file INI
var rowTemplate = "PDOmapping"

var gridDatapath = ""
var m_device
var m_extName
var m_disableUpdatePDO = false
var m_globalGroupName = "CANopen mappings"

var columns = { index: 0, subindex: 1, numPDO: 2, bitstart: 3, COBIDstr: 4, name: 5, objtype: 6, size: 7, label: 8, dataBlock: 9, type: 10 }
var m_columnsNodes = ["ioObject/@objectIndex", "ioObject/@objectSubIndex", "ioObject/@PDONumber", "ioObject/@PDOStartBit", "@COBIDstr", "name", "ioObject/@objtype", "size", "label", "dataBlock", "type"]

function InitGrid(datapath)
{	
	var COBIDValEnum = [
		0, "",
		1, "0",
		2, "0x000",
		3, "$NODEID+ 0x000",
		4, "0x80000000",
	]
	grid.AddEnum("COBIDValEnum", COBIDValEnum);
	
	grid.AddColumn( 40, 100, true, true,  egColumnType.egEdit, 0, "Idx")
	grid.AddColumn( 40, 100, true, true,  egColumnType.egEdit, 0, "Sub")
	grid.AddColumn( 42, 100, m_hasDynPDO ? false : true, true,  egColumnType.egEdit, 0, "PDO")
	grid.AddColumn( 35, 100, m_hasDynPDO ? false : true, true,  egColumnType.egEdit, 0, "Bit")
	grid.AddColumn(100, 100, false, false,  egColumnType.egComboTextEdit, 0, "COBID", "COBIDValEnum")
	grid.AddColumn(300, 100, true, false, egColumnType.egEdit, 0, "Object Name")
	grid.AddColumn( 60, 100, true, false,  egColumnType.egEdit, 0, "Type")
	grid.AddColumn( 38, 100, true, true,  egColumnType.egEdit, 0, "Size")
	grid.AddColumn(100, 100, false, false, egColumnType.egEdit, 0, "Label")
	grid.AddColumn( 80, 100, true, false, egColumnType.egEdit, 0, "DataBlock")
	grid.AddColumn(  0, 100, false, false, egColumnType.egEdit, 0, "type")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	grid.UseSlowEvents = false
	
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
	app.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	grid.InsertRows(1)
}

function grid_DeleteRowXML()
{
	UnAssign()

	if (grid.NumRows == 0) return
	var row = grid.SelectedRow
	
	var objtype = grid.Elem(row, columns.objtype)
	// verifica se gruppo di bit
	if (objtype == "BOOL")
	{
		var parent = app.SelectNodesXML(gridDatapath)[0]
		var idx = app.DataGet(gridDatapath + "/*[" + (row+1) + "]/ioObject/@objectIndex", 0)
		var sub = app.DataGet(gridDatapath + "/*[" + (row+1) + "]/ioObject/@objectSubIndex", 0)
		
		// estrae elenco con lo stesso idx e sub e li cancella tutti
		var nodeslist = parent.selectNodes("*[ioObject/@objectIndex = " + idx + " and ioObject/@objectSubIndex = " + sub + "]")
		var node
		while (node = nodeslist.nextNode())
			parent.removeChild(node)
			
		grid.DeleteRows(nodeslist.length)
	}
	else
	{
		// rimozione riga singola
		app.DataDelete(gridDatapath + "/*[" + (row+1) + "]", 0)
		grid.DeleteRows(1)
	}
	
	UpdatePDO()
}

var FLAG_NO_RO = 1
var FLAG_NO_WO = 2
var FLAG_ONLY_PDOMAPPING = 4

function CANAddRow()
{
	var devinfo = app.CallFunction("CANgeneric.GetCANgenericDeviceInfo", m_device.nodeName)
	if (!devinfo) return
	
	app.TempVar("newVar_showSplitBits") = true
	app.OpenWindow("newVar_CAN", "Set CAN object to map", gridDatapath + "/*")	
	var item = app.TempVar("newVar_item")
	
	// aggiunge una riga singola
	if ( item != undefined )
	{
		if ( item.splitBits )
		{
			// aggiunge una riga per singolo bit
			var size = app.CallFunction("common.GetIECTypeBits", item.typeIEC)
			item.typeIEC = "BOOL"
			for (var bit = 0; bit < size; bit++)
			{
				grid_AddRowXML()
				var row = grid.NumRows() - 1
				
				SetRowValues(row, item, devinfo.granularity, true, bit)
				grid.Update(row, -1)
			}
		}
		else
		{
			grid_AddRowXML()
			var row = grid.NumRows() - 1
		
			SetRowValues(row, item, devinfo.granularity, false)
			grid.Update(row, -1)
		}
	}
	
	UpdatePDO()
}

var PDOSIZE = 64

//	funzione chiamata per l'aggiunta di una nuova mappatura
function GetCOBIDstr( row, numpdo )
{
	// gestione COBID, se PDO già presente eredita il valore, altrimenti lo assegna in base alla codifica standard
	
	var COBIDstr = undefined
	for ( var r = 0; r < grid.NumRows(); r++ )
	{
		if ( r != row && grid.Elem(r, columns.numPDO) == numpdo )
			COBIDstr = app.DataGet(gridDatapath + "/*[" + (r+1) + "]/@COBIDstr", 0 )
	}
	if ( !COBIDstr ) COBIDstr = app.CallFunction( "CANgeneric.AssignCOBIDString", numpdo, m_isPDOTx )
	
	return COBIDstr
}

//	aggiorna tutte le stringhe COBID del pdo indicato con il valore COBIDstr, chiamata nella setelem
function SetCOBIDstr( numpdo, COBIDstr )
{
	for ( var r = 0; r < grid.NumRows(); r++ )
	{
		if ( grid.Elem(r, columns.numPDO) == numpdo )
		{
			app.DataSet(gridDatapath + "/*[" + (r+1) + "]/@COBIDstr", 0, COBIDstr )
			grid.Update(r, columns.COBIDstr)
		}
	}
}

function SetRowValues(row, item, granularity, splitBits, bitPos)
{
	if (row > 0)
	{
		// valori riga precedente
		var lastNumPDO  = parseInt(grid.Elem(row - 1, columns.numPDO))
		var lastBistart = parseInt(grid.Elem(row - 1, columns.bitstart))
		var lastSize    = parseInt(grid.Elem(row - 1, columns.size))
	}
	else
	{
		var lastNumPDO  = 1
		var lastBistart = 0
		var lastSize    = 0
	}
	
	if ( !item ) return
	var size = app.CallFunction("common.GetIECTypeBits", item.typeIEC)
	
	// calcolo automatico prima posizione libera nei PDO in base a riga precedente
	var bitstart = lastBistart + lastSize
	
	// se non siamo su un oggetto splittato in bits, oppure sul primo bit di un oggetto splittato lo allinea alla granularity
	if (!splitBits || bitPos == 0)
		if (granularity > 1 && bitstart % granularity != 0)
			bitstart += granularity - (bitstart % granularity)
	
	// verifica se sforato il PDO attuale, in caso va al successivo
	if (bitstart + size > PDOSIZE)
	{
		bitstart = 0
		lastNumPDO++
	}
	
	m_disableUpdatePDO = true
	grid.Elem(row, columns.index) = item.index
	grid.Elem(row, columns.subindex) = item.subindex
	grid.Elem(row, columns.numPDO) = lastNumPDO
	grid.Elem(row, columns.bitstart) = bitstart
	grid.Elem(row, columns.name) = item.name
	grid.Elem(row, columns.objtype) = item.typeIEC
	grid.Elem(row, columns.size) = size
	m_disableUpdatePDO = false
	
	app.DataSet(gridDatapath + "/*[" + (row+1) + "]/ioObject/@inout", 0, IO_INOUT)
}

function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}

function UpdatePDO()
{
	// l'update sul singolo campo viene bloccato quanto c'è una addrow
	if (m_disableUpdatePDO) return
	
	// ricalcolo setlist per transmission type
	if (m_isPDOTx)
	{
		app.CallFunction("CANgeneric.UpdatePDOTxTransmission", m_device)
		app.CallFunction("CANgeneric.UpdatePDOMapping", m_device, "tx")
	}
	else
	{
		app.CallFunction("CANgeneric.UpdatePDORxTransmission", m_device)
		app.CallFunction("CANgeneric.UpdatePDOMapping", m_device, "rx")
	}
}

function Assign()
{
	var type = grid.Elem(grid.SelectedRow, columns.objtype)
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", m_isPDOTx, type)
	
	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (no size)
	var c = { label: columns.label, type: columns.type, dataBlock: columns.dataBlock }
	
	AssignPLCVar(grid, c, type, dataBlock)
}

function UnAssign()
{
	var type = grid.Elem(grid.SelectedRow, columns.objtype)
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "CANopen_master", m_isPDOTx, type)

	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (no size)
	var c = { label: columns.label, type: columns.type, dataBlock: columns.dataBlock }
	
	UnAssignPLCVars(grid, c, dataBlock !== undefined)
}
