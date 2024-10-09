var tablePath = "ModbusCustom_config[1]/sendParams[1]"		// path relativo della tabella
var rowTemplate = "sendParam"		// nome del template della riga
var gridDatapath = ""

var columns = { parameter: 0, parAddress: 1, type: 2, value: 3, timeout: 4, enabled:5 }
var m_columnsNodes = [ "address", "address", "type", "value", "timeout", "enabled" ]

var gridErrorPos = { row: -1, col: -1 }
var m_currentUniqueID
var m_deviceParamsMap = {}
var m_parList = []
var m_protocol;

function InitGrid(datapath)
{
	gridDatapath = datapath + tablePath
	var node = app.SelectNodesXML(gridDatapath)[0]
	var device  = node.selectSingleNode(XPATH_ROOTDEVICE)
	m_currentUniqueID  = parseInt(device.getAttribute("uniqueID"))
	
	// device modbus slave generico corrente
	var parent = node.selectSingleNode(XPATH_PARENTDEVICE)
	// ottiene il protocol dal parent (la porta)
	m_protocol = parent.parentNode.getAttribute("protocol")
	
	var attr = (m_protocol == "ModbusTCP_master") ? "ModbusTCPInputOutputOnVariation" : "ModbusRTUInputOutputOnVariation";
	var hasInOutOnVar = genfuncs.ParseBoolean(device.getAttribute(attr));
	tabModbusCustomInputOutput.style.display = hasInOutOnVar ? "" : "none";
	
	
	// elenco di tutti i parametri modbus del device
	var parList = app.CallFunction("ModbusCustom.GetDeviceParameters", parent.nodeName)
	
	var enumList = [0, ""]
	for (var i = 0; i < parList.length; i++)
	{
		var par = parList[i]
		if (par.readOnly)
			continue  // se configurazione output e parametro readonly lo salta
		
		// lista per enumeratore
		enumList.push(par.ipa, par.name)
		// memorizza il parametro in una mappa per ricerca veloce
		m_deviceParamsMap[par.ipa] = par
		// array per finestra selezione parametro
		var item = {
			ipa: par.ipa, 
			name: par.name, 
			address: par.commIndex, 
			typeIEC: par.typeIEC, 
			description: par.description,
			defaultValue: par.defaultValue,
			typepar: par.typepar 
		}
		m_parList.push(item)
	}
	
	grid.AddEnum("paramsEnum", enumList)

	/*	enumerativi associati ai valori del parametro */
	
	var hasEnum = false
	// estrae il nodeName del nodo attivo (quello che stiamo configurando)
	var nodes = window.external.SelectNodesXML(datapath.slice(0, -1))
	if (nodes && nodes.length != 0)
		var id = nodes[0].nodeName
	else
		return

	// lista completa di tutti gli oggetti CAN
        var enumMap = app.CallFunction("ModbusCustom.GetDeviceParametersEnums", id)
	// aggiungo tutte le definizioni degli enumerativi
        if (enumMap)
	{
		CreateGridEnums( enumMap )
		hasEnum = true
	}

	grid.AddColumn(200, 100,  true, false, egColumnType.egCombo,  0, app.Translate("Parameter"), "paramsEnum")
	grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit,   0, app.Translate("Address"))
	grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit,   0, app.Translate("Type"))  //translate
	if ( hasEnum )
		grid.AddColumn( 200, 200, false, false, egColumnType.egMix, 0, "Value")
	else
		grid.AddColumn( 80, 100, false, true, egColumnType.egEdit, 0, app.Translate("Value"))  //translate
	grid.AddColumn( 80, 100, false,  true, egColumnType.egEdit,   0, app.Translate("TimeOut"))  //translate
	grid.AddColumn( 60, 100, false, false, egColumnType.egCheckbox,   0, app.Translate("Enabled"))  //translate
	
	grid.Init()
	grid.UseSlowEvents = hasEnum // solo se ci sono gli enum da gestire usa gli slow events
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function CreateGridEnums( enums )
{
	for (var id in enums)
	{
		var curEnum = enums[id]
		var list = []

		for (var value in curEnum)
			if (value != "default")
				list.push(parseInt(value), curEnum[value])

		grid.AddEnum("enum"+id, list)

		// l'elemento speciale chiamato 'default' viene impostato come stringa di default in caso di valore numerico non presente nella lista (solo per enum)
		// se nella stringa c'e il %i verra sostituito con il valore numerico
		if (curEnum["default"])
			grid.EnumSetDefault(id, curEnum["default"])
	}
}

function grid_AddRowXML()
{
	var inputList
	// negli output non permette la duplicazione dei parametri, di conseguenza filtra quelli gia usati
	var usedPars = {}
	
	for (var row = 0; row < grid.NumRows; row++)
	{
		var ipa = app.DataGet(BuildPath(row,columns.parAddress), 0)
		usedPars[ipa] = true
	}
	
	inputList = []
	for (var i = 0; i < m_parList.length; i++)
	{
		var item = m_parList[i]
		if (!usedPars[item.ipa])
			inputList.push(item)
	}
	
	//ordino la lista in base al commIndex
	if(inputList.length > 1)
		inputList.sort(compareByAddress);
	
	app.TempVar("VarsList_input") = inputList
	app.OpenWindow("VarsList", app.Translate("Modbus Parameters"), "")

	app.TempVar("VarsList_input") = undefined
	var result = app.TempVar("VarsList_result")
	if (!result || result.length == 0) return
	
	for (var i = 0; i < result.length; i++)
	{
		var item = inputList[result[i]]
		var datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false)
		app.DataSet(datapath + "/address", 0, item.ipa)
		app.DataSet(datapath + "/type", 0, item.typeIEC)
		
		if (item.defaultValue)
			app.DataSet(datapath + "/value", 0, item.defaultValue)
	}
	grid.InsertRows(result.length)

	grid.Move(grid.GetRealRow(grid.NumRows-1), columns.parameter)
}

function grid_DeleteRowXML()
{
	grid_DeleteMultiple(grid, gridDatapath)
}

function GetEnum( row )
{		
	var ipa = app.DataGet( gridDatapath + "/*[" + (row+1) + "]/address", 0 )	
	var par = m_deviceParamsMap[ipa]
	if ( par && par.typepar.substring( 0, 4 ) == "enum" )
		return par.typepar
	
	return
}
