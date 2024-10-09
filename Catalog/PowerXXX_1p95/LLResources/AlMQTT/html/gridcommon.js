var columns = {}
var m_columnsNodes = m_columnsDefinition

for (var i = 0; i < m_columnsNodes.length; i++)
{
    columns[m_columnsNodes[i].replace("@", "")] = i
}

var gridErrorPos = { row: -1, col: -1 }

var gridDatapath = ""
var rowTemplate = "brokerMapping"

var m_defValues = {
    prefix: "",
    clientname: "",
    qos: 0,
    retain: 0,
    payload: "bin",
    inhibittime: 0,
    polling: 0,
}

function GetDefaultTopicName()
{
    if (m_disableDefaultTopic)
        return "";

    var res = "";
    if (m_defValues.prefix)
        res = "/" + m_defValues.prefix;

    if (m_defValues.clientname)
        res += "/" + m_defValues.clientname;

    res += "/topic" + grid.NumRows;

    return res;

}

function InitGrid(datapath)
{
    gridDatapath = datapath + tablePath

    grid.AddEnum("ENUM_BOOL", [0, "False", 1, "True"])
    grid.AddEnum("ENUM_QOS", [0, "0 = Once (not guaranteed)", 1, "1 = At Least Once (guaranteed)", 2, "2 = Only Once (guaranteed)"])
    grid.AddEnum("ENUM_PAYLOAD", [0, "bin", 1, "json"])

    grid.AddColumn(200, 100, false, true, egColumnType.egOption, 0, app.Translate("Variable names"))

    grid.AddColumn(200, 100, false, false, egColumnType.egEdit, 0, app.Translate("Topic"))

    if (columns.ro)
        grid.AddColumn(80, 100, false, false, egColumnType.egCombo, 0, app.Translate("Read only"), "ENUM_BOOL")

    grid.AddColumn(200, 100, false, false, egColumnType.egCombo, 0, app.Translate("QoS"), "ENUM_QOS")

    if (columns.retain)
        grid.AddColumn(80, 100, false, false, egColumnType.egCombo, 0, app.Translate("Retain"), "ENUM_BOOL")

    grid.AddColumn(80, 80, false, false, egColumnType.egComboText, 0, app.Translate("Payload"), "ENUM_PAYLOAD")

    if (columns.inhibittime)
        grid.AddColumn(90, 100, false, true, egColumnType.egEdit, 0, app.Translate("Inhibit time (s)"))

    if (columns.polling)
        grid.AddColumn(110, 100, false, true, egColumnType.egEdit, 0, app.Translate("Send period (ms)"))

	grid.Init()

	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
    gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)

    // default values presi dalle impostazioni generali del broker (tab connection)
    var configNode = app.SelectNodesXML(gridDatapath + "/../.")[0];

    m_defValues.prefix = configNode.getAttribute("prefix");
    m_defValues.clientname = configNode.getAttribute("clientname");
    m_defValues.qos = configNode.getAttribute("qos");
    m_defValues.retain = configNode.getAttribute("retain");
    m_defValues.payload = configNode.getAttribute("payload");
    m_defValues.polling = configNode.getAttribute("polling");
}

function Assign()
{
	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (solo la label)
	// non specifica il datablock per utilizzare solo una finestra di "browse" che aggiorna la griglia senza assegnare a datablock
    var c = { label: columns.name }
	AssignPLCVar(grid, c)
}

function AssignRemote()
{
	if (!m_remoteSymbolsList)
	{
		app.MessageBox(app.Translate("No remote PLC variables available for selection.\nTo add some, choose a symbol table from the \"General\" tab"), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	if (grid.NumRows == 0)
		return;

	var row = grid.SelectedRow;
	var localVarName = grid.Elem(row, columns.local);
	var localVarType = GetLocalVarType(localVarName);

	var vars = [];
	for (var i = 0, t = m_remoteSymbolsList.length; i < t; i++)
	{
		var remoteVar = m_remoteSymbolsList[i];

		// se non c'e' la var locale o il tipo, mostra tutte le remote
		if (localVarName && localVarType)
		{
			if (localVarType.toLowerCase() == remoteVar.type.toLowerCase())
				vars.push(remoteVar);
		}
		else
			vars.push(remoteVar);
	}

	// apre la finestra per scegliere la var da assegnare e attende il risultato
	app.TempVar("VarsList_input") = vars;
	app.TempVar("varsList_multipleSel") = false;

	app.OpenWindow("PLCVarsList", app.Translate("Choose PLC variable"), "");

	app.TempVar("VarsList_input") = undefined;
	app.TempVar("varsList_multipleSel") = undefined;

	var result = app.TempVar("VarsList_result");
	if (!result || result.length == 0)
		return;

	var item = vars[result[0]]

	// setta i valori della riga
	grid.Elem(row, columns.remote) = item.name;

	grid.Update(row, -1);
}

function grid_AddRowXML()
{
	// aggiunge record nel documento xml e setta la colonna code
    var datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false);

    app.DataSet(datapath + "/@topic", 0, GetDefaultTopicName());
    app.DataSet(datapath + "/@ro", 0, 1)
    app.DataSet(datapath + "/@qos", 0, m_defValues.qos);
    app.DataSet(datapath + "/@retain", 0, m_defValues.retain);
    app.DataSet(datapath + "/@payload", 0, m_defValues.payload);
    app.DataSet(datapath + "/@inhibittime", 0, m_defValues.inhibittime);
    app.DataSet(datapath + "/@polling", 0, m_defValues.polling);


    grid.InsertRows(1)
	
	// si posiziona sulla colonna code del nuovo record (l'ultimo)
	grid.focus()
	grid.EditMode(true)
	grid.Move( grid.GetRealRow(grid.NumRows-1), columns.name )
}

function grid_DeleteRowXML()
{
	grid_DeleteMultiple(grid, gridDatapath)
}

/**
 * Torna il tipo della variabile passata
 * @param {string} varName 
 */
function GetLocalVarType(varName)
{
	var isComplex = app.CallFunction("script.IsComplexVar", varName);
	var v;
	if (isComplex)
		v = app.CallFunction("logiclab.FindSymbol", varName, "");
	else
		v = app.CallFunction("logiclab.GetGlobalVariable", varName);

	if (v)
		return v.Type;
}