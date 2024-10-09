var GRIDNAME = "CANPDOEntryList"      // nome della griglia, usato in file INI
var tablePath = "PDO_config[1]/PDO_entryList[1]"		// path relativo della tabella
var rowTemplate = "PDO_entry"

var gridDatapath = ""

var columns = { index: 0, subindex: 1, BitStart: 2, objtype: 3, size: 4, name: 5, readonly: 6, description: 7 }
var m_columnsNodes = ["index", "subindex", "BitStart"]

//  l'ultima colonna con dati xml associati
var LAST_COLUMN_XMLDATA = 2

var m_paramDBList = []
var m_paramDBMap = {}

function InitGrid(datapath)
{	
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "Index")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "SubIndex")
	grid.AddColumn(40, 100, false, true, egColumnType.egEdit,  0, "Bit")
    grid.AddColumn(40, 100, true,  true,  egColumnType.egEdit,  0, "Type")
	grid.AddColumn(40, 100, true,  true,  egColumnType.egEdit,  0, "Size")
    grid.AddColumn(160,200, true,  true,  egColumnType.egEdit,  0, "Name")
	grid.AddColumn(80, 100, true,  true,  egColumnType.egEdit,  0, "Readonly")
    grid.AddColumn(320,300, true,  true,  egColumnType.egEdit,  0, "Description")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	grid.UseSlowEvents = false
	
	GridLoadSettings(grid, GRIDNAME)
		
	// gestione evidenziamento errore
	SearchErrorTable(grid, gridDatapath, m_columnsNodes)

	RestoreGridSort(grid, gridDatapath)
	
	var node = app.SelectNodesXML(gridDatapath)[0]
	var device = node.selectSingleNode(XPATH_ROOTDEVICE)
	var useAlCOPS = (device.getAttribute( "useAlCOPS" ) == "true")
	
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var excludeReadOnly = !m_isTX
	var excludeTypeString = true

	if ( useAlCOPS )
	{
		// voglio solo gli oggetti mappabili CANopen (>= 0x2000)
		m_paramDBList = app.CallFunction(targetID + ".AlCOPSGetParamList", device, excludeReadOnly)
	}
	else
	{
		// voglio solo gli oggetti mappabili CANopen (>= 0x2000)
		m_paramDBList = app.CallFunction(targetID + ".GetParamList", excludeReadOnly, excludeTypeString, 0x2000)		
	}
	
	// inserisco i dummy object mappabili
	m_paramDBList.push( {index: "0x1", subindex: 0, name: "Dummy Object BOOLEAN", type: "BOOL", readonly: 0, description: ""} )
	m_paramDBList.push( {index: "0x2", subindex: 0, name: "Dummy Object INTEGER8", type: "SINT", readonly: 0, description: ""} )
	m_paramDBList.push( {index: "0x3", subindex: 0, name: "Dummy Object INTEGER16", type: "INT", readonly: 0, description: ""} )
	m_paramDBList.push( {index: "0x4", subindex: 0, name: "Dummy Object INTEGER32", type: "DINT", readonly: 0, description: ""} )
	m_paramDBList.push( {index: "0x5", subindex: 0, name: "Dummy Object UNSIGNED8", type: "BYTE", readonly: 0, description: ""} )
	m_paramDBList.push( {index: "0x6", subindex: 0, name: "Dummy Object UNSIGNED16", type: "WORD", readonly: 0, description: ""} )
	m_paramDBList.push( {index: "0x7", subindex: 0, name: "Dummy Object UNSIGNED32", type: "DWORD", readonly: 0, description: ""} )
	
	if ( useAlCOPS )
	{
		// voglio solo gli oggetti mappabili CANopen (>= 0x2000)
		m_paramDBMap = app.CallFunction(targetID + ".AlCOPSGetParamMap", device, false)
	}
	else
	{
		// voglio solo gli oggetti mappabili CANopen (>= 0x2000)
		m_paramDBMap = app.CallFunction(targetID + ".GetParamMap", false, excludeTypeString, 0x2000)
	}
	
	// inserisco i dummy object mappabili
	m_paramDBMap["0x1.0"] = {index: "0x1", subindex: 0, name: "Dummy Object BOOLEAN", type: "BOOL", readonly: 0, description: ""}
	m_paramDBMap["0x2.0"] = {index: "0x2", subindex: 0, name: "Dummy Object INTEGER8", type: "SINT", readonly: 0, description: ""}
	m_paramDBMap["0x3.0"] = {index: "0x3", subindex: 0, name: "Dummy Object INTEGER16", type: "INT", readonly: 0, description: ""}
	m_paramDBMap["0x4.0"] = {index: "0x4", subindex: 0, name: "Dummy Object INTEGER32", type: "DINT", readonly: 0, description: ""}
	m_paramDBMap["0x5.0"] = {index: "0x5", subindex: 0, name: "Dummy Object UNSIGNED8", type: "BYTE", readonly: 0, description: ""}
	m_paramDBMap["0x6.0"] = {index: "0x6", subindex: 0, name: "Dummy Object UNSIGNED16", type: "WORD", readonly: 0, description: ""}
	m_paramDBMap["0x7.0"] = {index: "0x7", subindex: 0, name: "Dummy Object UNSIGNED32", type: "DWORD", readonly: 0, description: ""}
}

function grid_AddRowXML()
{	
	window.external.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	grid.InsertRows(1)
}

function grid_DeleteRowXML()
{
	grid_DeleteMultiple(grid, gridDatapath)
}

var PDOSIZE = 64

function CANAddRow()
{
	if ( m_copsCfg.granularity == 1)
		var maxEntries = 64
	else
		var maxEntries = 8
	
	if ( grid.NumRows() >= maxEntries )
	{
		var msg = app.Translate( "Maximum number of entries reached for this PDO")
		app.MessageBox(msg, app.Translate( "PDO entries" ), MSGBOX.MB_ICONEXCLAMATION)
		return
	}
	
	var list = []
	
	//apro la lista delle com port effettivamente presenti sul pc
	for (var j = 0; j < m_paramDBList.length; j++)
	{
		var key =  "0x" + parseInt( m_paramDBList[j].index ).toString(16) + "." + m_paramDBList[j].subindex
	    list.push({ name: "0x" + parseInt( m_paramDBList[j].index ).toString(16) + "." + m_paramDBList[j].subindex + " (" + parseInt( m_paramDBList[j].index ) + "." + m_paramDBList[j].subindex + ") - " + m_paramDBList[j].name + " (" + m_paramDBList[j].type + ")", value: key })
	}
	
	app.TempVar("GenericList_input") = list
	app.TempVar("GenericList_multipleSel") = false
	app.OpenWindow("GenericList", app.Translate("Parameters list"), "")
	
	var result = app.TempVar("GenericList_result")
	
	app.TempVar("GenericList_input") = undefined
	app.TempVar("GenericList_multipleSel") = undefined
	app.TempVar("GenericList_result") = undefined
	
	if (!result || result.length == 0)
	    return false

    // aggiunge una riga vuota
	grid_AddRowXML()
	var row = grid.NumRows() - 1
    
    // cerca il parametro selezionato in base al risultato
	if (SetRowValues(row, result[0].value, m_copsCfg.granularity, 0, 0))
	{		
		// si posiziona sulla colonna code del nuovo record (l'ultimo)
		grid.Move( grid.GetRealRow(row), columns.BitStart )
		grid.focus()
		grid.Update(row, -1)
	}
	else
	{
		// si posiziona sulla colonna code del nuovo record (l'ultimo)
		grid.Move( grid.GetRealRow(row), columns.BitStart )
	    grid_DeleteRowXML()
	}
}

function SetRowValues(row, key, granularity, splitBits, bitPos)
{
	if (row > 0)
	{
		// valori riga precedente
		var lastBistart = parseInt(grid.Elem(row - 1, columns.BitStart))
		var lastSize    = parseInt(grid.Elem(row - 1, columns.size))
	}
	else
	{
		var lastBistart = 0
		var lastSize    = 0
	}
	
	var par = m_paramDBMap[ key ]
	
	//	calcola valore
	var typeIEC = splitBits ? "BOOL" : par.type
	var size = app.CallFunction("common.GetIECTypeBits", typeIEC)
	if ( size < granularity )
		size = granularity	//	BOOL viene trattato come BYTE
	
	// calcolo automatico prima posizione libera nei PDO in base a riga precedente
	var bitstart = lastBistart + lastSize
	
	// se non siamo su un oggetto splittato in bits, oppure sul primo bit di un oggetto splittato lo allinea alla granularity
	if (!splitBits || bitPos == 0)
		if (granularity > 1 && bitstart % granularity != 0)
			bitstart += granularity - (bitstart % granularity)
	
	// verifica se sforato il PDO attuale
	var showWarning = false
	if (bitstart + size > PDOSIZE)
	{
		//	forza a zero
		bitstart = 0
		showWarning = true
	}

	grid.Elem(row, columns.index) = par.index
	grid.Elem(row, columns.subindex) = par.subindex
	grid.Elem(row, columns.BitStart) = bitstart
	
	if ( showWarning )
	{
		var msg = app.Translate("Please check PDO mapping")
		app.MessageBox(msg, app.Translate( "PDO entries" ), MSGBOX.MB_ICONEXCLAMATION)
	}

	return true
}

function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}
