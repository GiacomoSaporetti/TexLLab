var gridParametrizationDatapath = "/devicetemplate/plcconfig/templatedata/PREFIX/ModbusCustom_config/sendParams";
var gridParametrizationColumns = { parameter: 0, address: 1, type: 2, value: 3, timeout: 4, enabled: 5 }
var m_ParametrizationNodes = [ "address", "address", "type", "value", "timeout", "enabled" ];
var rowTemplateParametrization = "sendParam";

function InitGridParametrization() {
	// init colonne
	gridParametrization.AddColumn(200, 100,  true, false, egColumnType.egEdit,  0, app.Translate("Parameter"));
	gridParametrization.AddColumn( 70, 100,  true, false, egColumnType.egEdit,   0, app.Translate("Address"));
	gridParametrization.AddColumn( 70, 100,  true, false, egColumnType.egEdit,   0, app.Translate("Type"));
	gridParametrization.AddColumn( 80, 100, false, true, egColumnType.egEdit, 0, app.Translate("Value"));
	gridParametrization.AddColumn( 80, 100, false,  true, egColumnType.egEdit,   0, app.Translate("TimeOut"));
	gridParametrization.AddColumn( 60, 100, false, false, egColumnType.egCheckbox,   0, app.Translate("Enabled"));

	gridParametrization.Init();
}

function AddRowParametrization() {
	var usedPars = {}

	// non permette la duplicazione dei parametri, di conseguenza filtra quelli già usati
	for (var row = 0; row < gridParametrization.NumRows; row++)
	{
		var ipa = GetNode(m_xmldoc, BuilParametrizationPath(row,columns.address), 0);
		usedPars[ipa] = true
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

	var nodeTempl = app.GetTemplateData(rowTemplateParametrization);
	if (!nodeTempl || nodeTempl.length == 0) {
		app.MessageBox(app.Translate("Cannot load row template"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}

	// aggiungo nodo "sendParam" sotto "sendParams"
	var destNode = m_xmldoc.selectSingleNode(gridParametrizationDatapath);
	var newNode = destNode.appendChild(nodeTempl[0].cloneNode(true));

	// rimuovo attributi che non servono
	newNode.removeAttribute("template");
	newNode.removeAttribute("version");

	var currPar = parList[index];

	SetNode(newNode, "address", currPar.ipa);
	SetNode(newNode, "type", currPar.typeIEC);

	// aggiorno griglia e togglo il modifiedflag
	gridParametrization.InsertRows(1);
	SetModifiedFlag();
}

function DeleteRowParametrization() {
	if (gridParametrization.NumRows == 0) return

	var selectionsArr = gridParametrization.GetSelections()
	if (selectionsArr != undefined)
	{
		var list = VBArray(selectionsArr).toArray()
		if (list.length > 0)
		{
			// ok multiselezione ON
			for (var i = list.length - 1; i >= 0; i--)
			{
				var row = list[i] + 1
				var node = m_xmldoc.selectSingleNode(gridParametrizationDatapath + "/*[" + row + "]")
				node.parentNode.removeChild(node)
			}
			gridParametrization.DeleteRows(list.length)
			SetModifiedFlag()
			return
		}
	}
}