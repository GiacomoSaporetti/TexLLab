var gridInputOutputBasePath = "/devicetemplate/plcconfig/templatedata/PREFIX/ModbusCustom_config/"
var gridInputDatapath = gridInputOutputBasePath + "inputs";
var gridOutputDatapath = gridInputOutputBasePath + "outputs";

var gridInputOutputColumns = { parameter: 0, address: 1, type: 2, pollingtime: 3, enabled: 4 }
var m_InputOutputColumnsNodes = [ "ioObject/@objectIndex", "ioObject/@objectIndex", "ioObject/@objtype", "pollTime", "enabled" ];

var rowTemplateInputOutput = "modbusMapping";

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ common input/output ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function InitGridInputOutput(grid) {
	// init colonne
	grid.AddColumn(200, 100,  true, false, egColumnType.egEdit,  0, app.Translate("Parameter"));
	grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Address"));
	grid.AddColumn( 70, 100,  true, false, egColumnType.egEdit, 0, app.Translate("Type"));
	grid.AddColumn( 80, 100, false,  true, egColumnType.egEdit, 0, app.Translate("Polling time"));
	grid.AddColumn( 60, 100, false, false, egColumnType.egCheckbox,   0, app.Translate("Enabled"));

	grid.Init()
}

function AddRowInputOutput(path, grid) {
	var usedPars = {}

	// negli output non permette la duplicazione dei parametri, di conseguenza filtra quelli già usati
	if (path == gridOutputDatapath)
	{
		for (var row = 0; row < grid.NumRows; row++)
		{
			var ipa = GetNode(m_xmldoc, BuildInputOutputPath(path, row, columns.address), 0);
			usedPars[ipa] = true
		}
	}

	// ottengo la lista dei param
	var parList = [];

	var parNodeList = m_xmldoc.selectNodes(gridDatapath + "/par");
	if (!parNodeList || parNodeList.length == 0)
		return;

	var node;
	while (node = parNodeList.nextNode()) {
		var item = {
			ipa: node.getAttribute("ipa"),
			name: node.getAttribute("name"),
			address: GetNode(node, "protocol/@commaddr"), 
			typeIEC: GetParTypeString(node.getAttribute("typetarg"), node.getAttribute("form")),
			typepar: node.getAttribute("typepar")
		}

		if (!usedPars[item.ipa])
			parList.push(item);
	}

	app.TempVar("VarsList_input") = parList
	app.OpenWindow("VarsList", app.Translate("Modbus Parameters"), "")

	app.TempVar("VarsList_input") = undefined
	var result = app.TempVar("VarsList_result")
	if (!result || result.length == 0)
		return;

	// il risultato ha un solo elemento
	var index = result[0];

	var nodeTempl = app.GetTemplateData(rowTemplateInputOutput);
	if (!nodeTempl || nodeTempl.length == 0) {
		app.MessageBox(app.Translate("Cannot load row template"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}

	// aggiungo nodo
	var destNode = m_xmldoc.selectSingleNode(path);
	var newNode = destNode.appendChild(nodeTempl[0].cloneNode(true));

	// rimuovo attributi che non servono
	newNode.removeAttribute("template");
	newNode.removeAttribute("version");

	var currPar = parList[index];

	SetNode(newNode, "ioObject/@objectIndex", currPar.ipa);
	SetNode(newNode, "ioObject/@objtype", currPar.typeIEC);

	// il valore di default e' in, quindi per gli input e' gia' a posto
	if (path == gridOutputDatapath)
		SetNode(newNode, "ioObject/@inout", "out");

	// aggiorno griglia e togglo il modifiedflag
	grid.InsertRows(1);
	SetModifiedFlag();
}

function DeleteRowInputOutput(path, grid) {
	if (grid.NumRows == 0) return

	var selectionsArr = grid.GetSelections()
	if (selectionsArr != undefined)
	{
		var list = VBArray(selectionsArr).toArray()
		if (list.length > 0)
		{
			// ok multiselezione ON
			for (var i = list.length - 1; i >= 0; i--)
			{
				var row = list[i] + 1
				var node = m_xmldoc.selectSingleNode(path + "/*[" + row + "]")
				node.parentNode.removeChild(node)
			}
			grid.DeleteRows(list.length)
			SetModifiedFlag()
			return
		}
	}
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ input ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function InitGridInput() {
	InitGridInputOutput(gridInput);
}

function AddRowInput() {
	AddRowInputOutput(gridInputDatapath, gridInput);
}

function DeleteRowInput() {
	DeleteRowInputOutput(gridInputDatapath, gridInput);
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ output ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function InitGridOutput() {
	InitGridInputOutput(gridOutput);
}

function AddRowOutput() {
	AddRowInputOutput(gridOutputDatapath, gridOutput);
}

function DeleteRowOutput() {
	DeleteRowInputOutput(gridOutputDatapath, gridOutput);
}