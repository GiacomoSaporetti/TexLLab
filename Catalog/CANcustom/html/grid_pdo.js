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

var columns = { index: 0, subindex: 1, numPDO: 2, bitstart: 3, COBID: 4, name: 5, objtype: 6, size: 7, label: 8, dataBlock: 9, type: 10 }
var m_columnsNodes = ["ioObject/@objectIndex", "ioObject/@objectSubIndex", "ioObject/@PDONumber", "ioObject/@PDOStartBit", "@COBID", "name", "ioObject/@objtype", "size", "label", "dataBlock", "type"]

function InitGrid(datapath)
{	
	grid.AddColumn( 40, 100, true, true,  egColumnType.egEdit, 0, "Idx")
	grid.AddColumn( 40, 100, true, true,  egColumnType.egEdit, 0, "Sub")
	grid.AddColumn( 42, 100, m_hasDynPDO ? false : true, true,  egColumnType.egEdit, 0, "PDO")
	grid.AddColumn( 35, 100, m_hasDynPDO ? false : true, true,  egColumnType.egEdit, 0, "Bit")
	if ( m_hasDynNodeID )
	{
		m_columnsNodes[ columns.COBID ] = "@COBIDstr"
		grid.AddColumn( 55, 100, true, false,  egColumnType.egEdit, 0, "COBID")
	}
	else
	{
		m_columnsNodes[ columns.COBID ] = "@COBID"
		grid.AddColumn( 55, 100, true, true,  egColumnType.egEdit, 0, "COBID")
	}
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
var FLAG_NO_RWW = 8
var FLAG_NO_RWR = 16

function CANAddRow()
{
	// mostra il form di selezione variabile e legge il risultato tramite variabile temporanea
	// lista completa di tutti gli oggetti CAN
	var devinfo = app.CallFunction("CANcustom.GetCANCustomDeviceInfo", m_device.nodeName)
	if (!devinfo) return
	
	var parMap = devinfo.parMap
	if (!parMap) return
	app.TempVar("varsList_parMap") = parMap
	app.TempVar("varsList_Index_path") = "ioObject/@objectIndex"
	app.TempVar("varsList_SubIndex_path") = "ioObject/@objectSubIndex"
	app.TempVar("varsList_Flags") = VARSLIST_FLAGS
	app.TempVar("varsList_showSplitBits") = true
	
	app.OpenWindow("varsList_CAN", "Variables List", gridDatapath + "/*")
	var result = app.TempVar("varsList_result")
	var chkSplitBits = app.TempVar("varsList_splitBits")
	
	app.TempVar("varsList_parMap") = undefined
	app.TempVar("varsList_result") = undefined
	app.TempVar("varsList_Index_path") = undefined
	app.TempVar("varsList_SubIndex_path") = undefined
	app.TempVar("varsList_Flags") = undefined
	app.TempVar("varsList_splitBits") = undefined
	app.TempVar("varsList_showSplitBits") = undefined
	if (! result) return

	
	for (var i = 0; i < result.length; i++)
	{
		var par = parMap[result[i]]
		if (par)
		{
			//var splitBits = chkSplitBits || app.CallFunction("CANcustom.IsDigitalObject", par.commIndex, parMap)
			
			if (chkSplitBits)
			{
				// aggiunge una riga per singolo bit
				var IECtype = app.CallFunction("parameters.ParTypeToIEC", par.type, par.format)
				var size = app.CallFunction("common.GetIECTypeBits", IECtype)
				
				for (var bit = 0; bit < size; bit++)
				{
					grid_AddRowXML()
					var row = grid.NumRows() - 1
					
					SetRowValues(row, par, devinfo.granularity, true, bit)
					grid.Update(row, -1)
				}
			}
			else
			{
				// aggiunge una riga singola
				grid_AddRowXML()
				var row = grid.NumRows() - 1
				
				SetRowValues(row, par, devinfo.granularity, false)
				grid.Update(row, -1)
			}
		}
	}
	
	UpdatePDO()
}

var PDOSIZE = 64

function SetRowValues(row, par, granularity, splitBits, bitPos)
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
	
	var typeIEC = splitBits ? "BOOL" : par.typeIEC
	var size = app.CallFunction("common.GetIECTypeBits", typeIEC)
	
	
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
	grid.Elem(row, columns.index) = par.commIndex
	grid.Elem(row, columns.subindex) = par.commSubIndex
	grid.Elem(row, columns.numPDO) = lastNumPDO
	grid.Elem(row, columns.bitstart) = bitstart
	grid.Elem(row, columns.name) = par.name
	grid.Elem(row, columns.objtype) = typeIEC
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
		app.CallFunction("CANcustom.UpdatePDOTxTransmission", m_device)
		app.CallFunction("CANcustom.UpdatePDOMapping", m_device, "tx")
	}
	else
	{
		app.CallFunction("CANcustom.UpdatePDORxTransmission", m_device)
		app.CallFunction("CANcustom.UpdatePDOMapping", m_device, "rx")
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
