var EXTNAME = "Motion";
var m_path;
var m_allAxes = app.CallFunction(EXTNAME + ".GetAllMotionAxesFromProject");

const MICRO_CHAR = "\u00B5";
const STANDARD_LU_UM = ['degree', 'mm', 'm'];

function InitPage()
{
	if (GUI_DEBUG)
		return;

	m_path = app.GetCurrentWindowData();

	let lengthUnit = app.DataGet(m_path + "@lengthUnit", 0);
	onChangeLengthUnit(lengthUnit);

	let timeUnit = app.DataGet(m_path + "@timeUnit", 0);
	updateTimeUnitUM(timeUnit);

	fillFieldbusSel();

	// tempo ciclo del fast solo descrittivo
	txtCycleTime.value = app.CallFunction(EXTNAME + ".GetPLCCycleTimeMs");

	enableDisableModule(app.DataGet(m_path + "@type", 0));

	// se e' una UM custom
	if (STANDARD_LU_UM.indexOf(lengthUnit) === -1) {
		onChangeLengthUnitCustomUM(lengthUnit);
		customLengthUnitTxt.value = lengthUnit;
	}

	// per togliere il focus dal toggle switch e fixare il bug del disable dell'asse dal tree
	document.body.focus();
}

function OnLoad()
{
	// da fare dopo l'associazione dei controlli .D()
	fillDriverSel(fieldbusSel.value, false);
}

function fillFieldbusSel()
{
	let names = [];
	for (let name in m_allAxes)
		names.push(name);
	names.sort();
	
	for (let i = 0; i < names.length; i++)
		AddOption(fieldbusSel, names[i]);
	
	AddOption(fieldbusSel, "Virtual");
}

function AddOption(selectObj, value, text)
{
	let newOpt = document.createElement('option');
	newOpt.value = value;
	if (text)
		newOpt.innerText = text;
	else
		newOpt.innerText = value;
	
	selectObj.appendChild(newOpt);
}

function Reload()
{
	app.RefreshWindow("", gentypes.enuRefreshWinType.refParseAgain);
}

function OnChangeFieldbus()
{
	fillDriverSel(fieldbusSel.value, true);
	
	let axis = m_allAxes[fieldbusSel.value];
	if (!axis)
		return;
	
	// settaggio di tutti i valori di default sull'asse
	let axisNode = app.SelectNodesXML(datapath.value + ".")[0];
	
	let defaults = axis.axisData.defaults;
	for (var attrName in defaults)
		axisNode.setAttribute(attrName, defaults[attrName]);
	
	// rinfresca in ritardo per non perdere la selezione del nuovo fieldbus
	setTimeout(Reload, 0);
}

function fillDriverSel(axisName, selectFirst)
{
	var curValue = "";
	if (!selectFirst)
		curValue = app.DataGet(datapath.value + "@driver", 0);
	
	driverSel.options.length = 0;
	let axis = m_allAxes[axisName];
	if (axis)
	{
		var drivers = axis.axisData.drivers;
		for (let i = 0; i < drivers.length; i++)
		{
			AddOption(driverSel, drivers[i]);
			
			if (i == 0 && selectFirst)
				curValue = drivers[i];
		}
	}
	
	driverSel.value = curValue;
	app.DataSet(datapath.value + "@driver", 0, curValue);
}

function onChangeLengthUnit(value) {
	// se UM standard
	if (STANDARD_LU_UM.indexOf(value) !== -1) {
		customLengthUnitTxt.value = "";
		customLengthUnitRadioBtn.value = "";
		customLengthUnitTxt.disabled = true;
	}
	else
		customLengthUnitTxt.disabled = false;

	updateLengthUnitUM(value);
}

function updateLengthUnitUM(value) {
	let allEuElems = document.querySelectorAll('[data-unit="EU"]');
	for (let key in allEuElems) {
		if (Object.hasOwnProperty.call(allEuElems, key)) {
			let element = allEuElems[key];
			if (element.nodeType !== Node.ELEMENT_NODE)
				continue;

			element.innerText = value;
		}
	}
}

function updateTimeUnitUM(value) {
	if (value === "msec")
		value = "ms";
	else if (value === "usec")
		value = MICRO_CHAR + "s";

	let allTuElems = document.querySelectorAll('[data-unit="TU"]');
	for (let key in allTuElems) {
		if (Object.hasOwnProperty.call(allTuElems, key)) {
			let element = allTuElems[key];
			if (element.nodeType !== Node.ELEMENT_NODE)
				continue;

			element.innerText = value;
		}
	}
}

function onChangeLengthUnitCustomUM(value) {
	// setto il valore custom al radio button come stratagemma per fare in modo che venga gestito come se fosse un radio button "fisso"
	customLengthUnitRadioBtn.value = value;
	// faccio la dataset altrimenti perderei il valore ad es. quando cambio pagina
	app.DataSet(datapath.value + "@lengthUnit", 0, value);
	updateLengthUnitUM(value);
}

function enableDisableModule(enabled) {
	enabled = genfuncs.ParseBoolean(enabled);
	moduleTxt.disabled = !enabled;
}

function EnableDisableAxisOnTree(flag)
{
	app.CallFunction(EXTNAME + ".EnableDisableItemOnTree", flag);
}

function UpdateTreeCaption()
{
	var treePath = app.HMIGetCurElementPath("tree1");
	// aggiorna la nuova caption sull'albero sull'elemento attivo
	app.HMISetCaption("tree1", treePath, txtName.value)
}