var tablePath = "."		// path relativo della tabella
var columns = { name: 0, value: 1, sendonvariation: 2, threshold: 3 }
var rowTemplate = "brokerField"

var m_columnsNodes;

var gridDatapath = ""
var m_isPublishPage;

const PAYLOAD_TYPE = {
	BIN: "bin",
	JSON: "json"
}

function InitPage()
{
	FixStyleForGrids();

	// con dark theme vengono usate altre immagini
	let imgPathPrefix = m_darkTheme ? "../img/btn/dark_theme/" : "../img/btn/";

	imgPlus.src = csspath + imgPathPrefix + 'plus.png';
	imgMinus.src = csspath + imgPathPrefix + 'minus.png';
	imgIn.src = csspath + imgPathPrefix + 'arrowIn.png';
	imgUp.src = csspath + imgPathPrefix + 'arrowUp.png';
	imgDown.src = csspath + imgPathPrefix + 'arrowDown.png';
	imgPreview.src = csspath + imgPathPrefix + "preview.png";
	imgClose.src = csspath + imgPathPrefix + 'close.png';

	try
	{
		grid.SetDarkTheme(m_darkTheme);
	}
	catch (err) {}
}

function InitGrid(datapath)
{
	gridDatapath = datapath + tablePath

	m_isPublishPage = datapath.includes("publish");

	let payload = app.TempVar("Payload_type");
	app.TempVar("Payload_type") = undefined;

	// se il payload e' JSON nascondo i bottoni move up e move down perche' sono inutili
	// con payload binario serve per cambiare l'ordine con cui i parametri pubblicati/sottoscritti vengono spediti/ricevuti
	if (payload == PAYLOAD_TYPE.JSON) {
		spanMoveUp.style.display = "none";
		spanMoveDown.style.display = "none";
	}
	else if (payload == PAYLOAD_TYPE.BIN)
		spanJSONPreview.style.display = "none";

	if (m_isPublishPage)
	{
		if (payload == PAYLOAD_TYPE.BIN)
		{
			columns = { value: 0, sendonvariation: 1, threshold: 2 };
			m_columnsNodes = ["@value", "@sendonvariation", "@threshold"];
		}
		else
		{
			columns = { name: 0, value: 1, sendonvariation: 2, threshold: 3 };
			m_columnsNodes = ["@name", "@value", "@sendonvariation", "@threshold"];

			grid.AddColumn(150, 100, false, false, egColumnType.egEdit, 0, app.Translate("Field name")); // nome field per payload JSON
		}

		grid.AddEnum("ENUM_BOOL", [0, "False", 1, "True"]);
		grid.AddColumn(150, 100, false, false, egColumnType.egEditOpt, 0, app.Translate("Field value")); // nome variabile
		grid.AddColumn(110, 100, false, false, egColumnType.egCombo, 0, app.Translate("Send on variation"), "ENUM_BOOL");
		grid.AddColumn(110, 100, false, true, egColumnType.egEdit, 0, app.Translate("Threshold"));
	}
	else
	{
		if (payload == PAYLOAD_TYPE.BIN)
		{
			columns = { value: 0 };
			m_columnsNodes = ["@value"];
		}
		else
		{
			columns = { name: 0, value: 1 };
			m_columnsNodes = ["@name", "@value"];

			grid.AddColumn(150, 100, false, false, egColumnType.egEdit, 0, app.Translate("Field name")); // nome field per payload JSON
		}

		grid.AddColumn(150, 100, false, false, egColumnType.egOption, 0, app.Translate("Field value"));
	}

	grid.Init()

	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function grid_AddRowXML()
{
	// aggiunge record nel documento xml e setta la colonna code
	var datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false);

	grid.InsertRows(1)
	
	// // si posiziona sulla colonna code del nuovo record (l'ultimo)
	grid.focus()
	grid.EditMode(true)
	grid.Move( grid.GetRealRow(grid.NumRows-1), columns.name )
}

function grid_DeleteRowXML()
{
	grid_DeleteMultiple(grid, gridDatapath)
}

function Assign()
{
	// passa un set di indici di colonne ridotto per non causare modifiche alle altre (solo la label)
	// non specifica il datablock per utilizzare solo una finestra di "browse" che aggiorna la griglia senza assegnare a datablock
	var c = { label: columns.value }
	AssignPLCVar(grid, c)
}

function ShowJSONPreview()
{
	// costruisce ricorsivamente l'oggetto della preview e assegna i valori tenendo conto che il . significa
	// avere una property innestata. Quindi cnt.obj.bar viene effettivamente pubblicato dal broker come
	// {
	// 	"cnt": {
	// 		"obj": {
	// 			"bar": 1234
	// 		}
	// 	}
	// }
	function BuildObj(varName, obj, valStr) {
		if (varName.includes('.')) {
			let namesList = varName.split('.');
			let currName = namesList[0];

			if (!obj[currName])
				obj[currName] = {};

			// rimuovo dall'oggetto splittato il pezzo corrente
			if (namesList.length > 1)
				namesList.splice(0, 1);

			// riunisco i nomi rimanenti
			return BuildObj(namesList.join('.'), obj[currName], valStr);
		}

		return obj[varName] = valStr;
	}


	let varMap = {};

	let nodes = app.SelectNodesXML(gridDatapath + "/*");
	var node;
	while (node = nodes.nextNode())
	{
		var varVal = node.getAttribute("value");
		var varName = node.getAttribute("name");
		if (!varName || !varVal)
			continue;

		if (m_isPublishPage) {
			// se e' un numero (costante) appendo apici all'inizio e in fondo
			varVal = varVal.replace(/^(\d+)$/, "'$1'");
			// se e' una stringa (o numero) delimitata da doppi apici li sostituisco con apici singoli
			varVal = varVal.replace(/^"(\w+)"$/, "'$1'")
		}

		let valStr = "";
		// se timestamp
		if (varVal.match(/^<timestamp>$/))
			valStr = "<TIMESTAMP_VALUE>";
		// se costante delimitata da singoli apici
		else if (varVal.match(/^'[\w\s]+'$/))
			valStr = varVal.replace(/'/g, '');
		else
			valStr = "<VAR_VALUE>";

		BuildObj(varName, varMap, valStr);
	}

	// il secondo parametro dello stringify serve per ottenere un JSON formattato
	let jsonStr = JSON.stringify(varMap, null, 2);
	// tolgo i doppi apici da <VAR_VALUE> e <TIMESTAMP_VALUE>
	jsonStr = jsonStr.replace(/"(<VAR_VALUE>|<TIMESTAMP_VALUE>)"/g, '$1');
	app.TempVar("MQTTJSONPreview_input") = jsonStr;
	app.OpenWindow("MQTTJSONPreview", app.Translate("JSON preview"), "");
}

// ------------------------------------------------ eventi grid ------------------------------------------------
function BuildPath(row, col)
{
	return gridDatapath + "/*[" + (row + 1) + "]/" + m_columnsNodes[col]
}

function grid::GetElemS(row, col)
{
	grid.EventResult = app.DataGet(BuildPath(row, col), 0)
}

function grid::GetElemI(row, col)
{
	grid.EventResult = app.DataGet(BuildPath(row, col), 0)
}

function grid::SetElemS(row, col, s)
{
	app.DataSet(BuildPath(row, col), 0, s)
}

function grid::SetElemI(row, col, i)
{
	app.DataSet(BuildPath(row, col), 0, i)
}

function grid::GetRecordNum()
{
	var list = app.SelectNodesXML(gridDatapath + "/*")
	if (list) grid.EventResult = list.length
}

function grid::OptionClick(row, col)
{
	if (col == columns.value)
		Assign();
}

function grid::ColClick(col)
{
    GridSort(grid, gridDatapath, col)
}