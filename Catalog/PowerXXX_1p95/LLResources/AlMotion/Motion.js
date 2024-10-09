var TREENAME = "tree1";
var genfuncs = app.CallFunction("common.GetGeneralFunctions");
var gentypes = app.CallFunction("common.GetGeneralTypes");

// id icone di overlay per l'albero (vedi LogicLab.pct!)
var TREE_OVERLAY_NONE = 0
var TREE_OVERLAY_DISABLED = 1

var PLUGIN_ROOT_NODE = "Motion";
var PLUGIN_PCT_PATH = "%TARGETPCTPATH%\\..\\Motion\\Motion.pct";

var MOTION_DB = 102;

var MOTIONSLAVETYPE =
{
	ETHERCAT: 0,
	VIRTUAL: 1
};

var DEFAULT_MIN_EU = -100;
var DEFAULT_MAX_EU = 100;

var DEFAULT_DS402_MAPPING =
{
	controlword:		{ index: 0x6040,	subindex: 0,	type: "UINT" },
	statusword:			{ index: 0x6041,	subindex: 0,	type: "UINT" },
	op_mode:			{ index: 0x6060,	subindex: 0,	type: "SINT" },
	op_mode_display:	{ index: 0x6061,	subindex: 0,	type: "SINT" },
	target_position:	{ index: 0x607A,	subindex: 0,	type: "DINT" },
	target_velocity:	{ index: 0x60FF,	subindex: 0,	type: "DINT" },
	target_torque:		{ index: 0x6071,	subindex: 0,	type: "INT"  },
	actual_position:	{ index: 0x6064,	subindex: 0,	type: "DINT" },
	actual_velocity:	{ index: 0x606C,	subindex: 0,	type: "DINT" },
	actual_torque:		{ index: 0x6077,	subindex: 0,	type: "INT"  },
	errorcode:			{ index: 0x603F,	subindex: 0,	type: "UINT" },
	follow_err_actual:	{ index: 0x60F4,	subindex: 0,	type: "DINT" }
};

var DEFAULT_DS402_OBJECTINDEXOFFSET = 100;  // TODO


var VIRTUAL_NAME = "Virtual";

var VIRTUAL_DRIVER = "MC_Driver_VirtualAxis";

var VIRTUAL_AXISDATA = {
	name: "axis1",
	mappingsDS402: true,
	mappingsObjectIndexOffset: DEFAULT_DS402_OBJECTINDEXOFFSET,
	drivers: [ VIRTUAL_DRIVER ],
	mappings: DEFAULT_DS402_MAPPING,
	defaults: {}
};



function NewMotionVirtualAxis()
{
	var axis = {
		name: VIRTUAL_NAME,
		type: MOTIONSLAVETYPE.VIRTUAL,
		axisData: VIRTUAL_AXISDATA,
		slaveObj: null
	}
	return axis;
}


// sostituzione nel templatedata principale del target del placeholder con il nome del plugin con il vero nodo con tutti gli attributi reali
function AdjustTemplateData()
{
	var newNode = app.GetTemplateData(PLUGIN_ROOT_NODE)[0].cloneNode(true);
	// usa var di ambiente TARGETPCTPATH per permettere aggiornamenti e cambi target indolori (richiede LogicLab >= 5.13.0.12)
	newNode.setAttribute("template", PLUGIN_PCT_PATH);
	
	var rootNode = app.GetTemplateData(app.CallFunction("logiclab.get_TargetID"))[0];
	rootNode.replaceChild(newNode, rootNode.selectSingleNode(PLUGIN_ROOT_NODE))
}

function UpgradeOldTargetNode(device)
{
	var newNode = app.GetTemplateData(PLUGIN_ROOT_NODE)[0].cloneNode(true);
	// usa var di ambiente TARGETPCTPATH per permettere aggiornamenti e cambi target indolori (richiede LogicLab >= 5.13.0.12)
	newNode.setAttribute("template", PLUGIN_PCT_PATH);
	device.appendChild(newNode);
}


// ripristina gli stati dell'albero all'apertura del progetto
function OnLoadAxis(node)
{
	var enabled = node.getAttribute("axisEnabled");

	var datapath = app.GetDataPathFromNode(node)
	var treepath = app.HMIGetElementPath(TREENAME, datapath);
	EnableDisableItemOnTree(genfuncs.ParseBoolean(enabled), treepath);
}

/*
function OnLoadMaster(node)
{
	var enabled = node.getAttribute("masterEnabled");

	var datapath = app.GetDataPathFromNode(node)
	var treepath = app.HMIGetElementPath(TREENAME, datapath);
	EnableDisableItemOnTree(genfuncs.ParseBoolean(enabled), treepath);
}
*/

function AddAxis()
{
	var curdata = app.HMIGetElementData(TREENAME, "")

	var datapath = app.AddTemplateData("llMotionAxis", curdata, 0, false)
	app.CallFunction("common.AssignUniqueID", datapath);

	// mette subito in editing la caption
	var itempath = app.HMIGetElementPath(TREENAME, datapath)
	if (itempath)
		app.HMIEditElement(TREENAME, itempath)
}

function DeleteAxis()
{
	var ris = app.MessageBox(app.Translate("Do you want to delete the selected axis?"), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_YESNO);
	if (ris == gentypes.MSGBOX.IDNO)
		return;

	// cancellazione nodo corrente (sara' un "asse")
	var curdata = app.HMIGetElementData(TREENAME, "")

	app.DataDelete(curdata, 0)
	// va sulla pagina vuota
	app.OpenWindow("emptypage", "", "")
}

function OnAxisEdit(treepath, newtext)
{
	// rinfresca la finestra corrente per aggiornare il titolo
	var curdata = app.HMIGetElementData(TREENAME, treepath)

	app.HMISetCurElement(TREENAME, treepath)
	app.OpenWindow(app.HMIGetLinkedWindow(TREENAME, treepath), "", curdata)
}

function EnableDisableAxis()
{
	// ottiene il data del nodo corrente (su cui si è cliccato)
	var curdata = app.HMIGetElementData(TREENAME, "");

	var enabled = app.DataGet(curdata + "/@axisEnabled", 0);
	enabled = genfuncs.ParseBoolean(enabled);

	enabled = !enabled;

	var treepath = app.HMIGetElementPath(TREENAME, curdata);

	EnableDisableItemOnTree(enabled, treepath);

	app.DataSet(curdata + "/@axisEnabled", 0, enabled ? 1 : 0);

	// riapre finestra corrente per refreshare il checkbox nella pagina
	app.OpenWindow(app.HMIGetLinkedWindow(TREENAME, treepath), "", curdata)
}

function EnableDisableItemOnTree(enabled, treepath)
{
	app.HMISetOverlayImg(TREENAME, treepath, enabled ? TREE_OVERLAY_NONE : TREE_OVERLAY_DISABLED)
}

function CopyAxis()
{
	var curdata = app.HMIGetElementData(TREENAME, "");
	var nodelist = app.SelectNodesXML(curdata);
	if (!nodelist || nodelist.length == 0)
		return;
	
	app.Clipboard = nodelist[0].xml;
}

function GetAxisFromClipboard()
{
	if (!app.Clipboard)
		return;
	
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0");
	xmldoc.async = false;
	if (!xmldoc.loadXML(app.Clipboard))
		return;

	if (xmldoc.documentElement.nodeName != "llMotionAxis")
		return;
	
	return xmldoc.documentElement;
}

function PasteAxis()
{
	var axisNode = GetAxisFromClipboard();
	if (!axisNode)
	{
		app.MessageBox(app.Translate("Can not paste, invalid clipboard data"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}
	
	var rootNode = app.SelectNodesXML("/*[@IsRootDevice]/" + PLUGIN_ROOT_NODE)[0];
	rootNode.appendChild(axisNode)
	
	// per aggiunta automatica nell'albero
	app.ParseNode(axisNode);
	app.ModifiedFlag = true;
}


/**
 * Stampa nei log l'errore specificato nei parametri della funzione
 * @param {string} errStr il messaggio di errore da stampare
 * @param {string} funcName il nome della funzione in cui si e' verificato l'errore
 * @param {object} node il nodo in cui si e' verificato l'errore
 * @param {string} attributeName il nome dell'attributo problematico (opzionale, solo se attributo)
 */
function CriticalError(errStr, funcName, node, attributeName)
{
	throw genfuncs.AddLog(gentypes.enuLogLevels.LEV_CRITICAL, funcName, errStr, genfuncs.SplitFieldPath(node, attributeName));
}

var MOTION_PLC_FILENAME = "Motion";

function Build(rootDevice)
{
	var content;
	try
	{
		content = GenerateCode(rootDevice);
	}
	catch (exc)
	{
		// exc sara' tipicamente il enuLogLevels.xxx, propagato al chiamante
		return exc;
	}
	
	var filename = MOTION_PLC_FILENAME + ".plc";
	if (content === "")
	{
		// nessun codice generato, rimuove il codice aux eventualmente presente
		app.CallFunction( "compiler.LogicLab_RemovePLC", app.CallFunction("logiclab.get_ProjectPath"), filename )
	}
	else
	{
		app.CallFunction( "compiler.LogicLab_UpdatePLC", app.CallFunction("logiclab.get_ProjectPath"), filename, content )
		app.PrintMessage( "Created Motion code", gentypes.enuLogLevels.LEV_INFO )
	}
	return true;
}

// ----------------------------- INIZIO classe MotionGeneratedVars -------------------
function MotionGeneratedVars()
{
	this.varsMap = {};
}

MotionGeneratedVars.prototype.MakeMapKey = function(idx, sub)
{
	return idx.toString(16) + "." + sub;
}

MotionGeneratedVars.prototype.AddVar = function(index, subindex, name, type, datablock)
{
	var key = this.MakeMapKey(index, subindex);
	var item = { Name: name, Type: type, Datablock: datablock };
	this.varsMap[key] = item;
}

MotionGeneratedVars.prototype.FindVar = function(index, subindex)
{
	var key = this.MakeMapKey(index, subindex);
	return this.varsMap[key];
}
// ----------------------------- FINE classe MotionGeneratedVars -------------------

function GetPLCCycleTimeMs()
{
	return app.CallFunction("logiclab.get_TaskPeriod", "Fast");
}

function AxisName(axisNode)
{
	var axis_name = "_" + genfuncs.Trim(axisNode.getAttribute("caption")) + "_";
	axis_name = axis_name.replace(/\s/g, '_');
	return axis_name;
}

function DriverName(axisNode)
{
	var axis_name = AxisName(axisNode);
	var driver_name = axis_name + "driver";
	return driver_name;
}

function DriverType(axisNode)
{
	var fieldbus = axisNode.getAttribute("fieldbus");
	var driver;

	if (fieldbus != VIRTUAL_NAME)
	{
		driver = axisNode.getAttribute("driver");
	}
	else
	{
		driver = VIRTUAL_DRIVER;
	}
	return driver;
}

function Axis(axisNode, allAxes)
{
	var fieldbus = axisNode.getAttribute("fieldbus");
	var axis;
		
	if (fieldbus != VIRTUAL_NAME)
	{
		axis = allAxes[fieldbus];
	}
	else
	{
		axis = NewMotionVirtualAxis();
	}	
	
	return axis;
}

function GenerateCode(rootDevice)
{
	var FUNCNAME = "GenerateCode";
	
	var allAxes = GetAllMotionAxesFromProject();
	
	var code = "(* Automatically generated code, do not edit! *)\n\n";

	var axisNodelist = rootDevice.selectNodes(PLUGIN_ROOT_NODE + "/llMotionAxis");
	var axisNode;
	var exitEarly = true;
	while (axisNode = axisNodelist.nextNode())
	{
		var axisEnabled = genfuncs.ParseBoolean(axisNode.getAttribute("axisEnabled"));
		if (axisEnabled == false)
			continue;
		
		exitEarly = false;
	}
	
	if (exitEarly == true)
	{
		return code;
	}

	// Axis variables
	///////////////////
	
	axisNodelist.reset();
	var dbidx = 0;
	var usedNamesMap = {};
	
	while (axisNode = axisNodelist.nextNode())
	{
		var axisEnabled = genfuncs.ParseBoolean(axisNode.getAttribute("axisEnabled"));
		if (axisEnabled == false)
			continue;
		
		var name = axisNode.getAttribute("caption");
		if (name in usedNamesMap)
			CriticalError(app.Translate("Duplicated axis name: ") + name, FUNCNAME, axisNode);
		else
			usedNamesMap[name] = true;
		
		var driver = DriverType(axisNode);
		var axis = Axis(axisNode,allAxes);
				
		if (!axis)
			CriticalError(app.Translate("Invalid fieldbus slave specified: ") + fieldbus, FUNCNAME, axisNode);
		if (!driver)
			CriticalError(app.Translate("Invalid driver specified: ") + driver, FUNCNAME, axisNode);
		
		// Motion vars generation
		var vprefix = AxisName(axisNode);
		
		code +=		
"VAR_GLOBAL\n\
	{G:Motion_Vars}\n"
	
		var generatedVars = new MotionGeneratedVars();
		var mappings = axis.axisData.mappings;
		
		for (var name in mappings)
		{
			var mapping = mappings[name];
			var fullname = vprefix + name;
			var datablock = "%MD" + MOTION_DB + "." + dbidx;
			generatedVars.AddVar(mapping.index, mapping.subindex, fullname, mapping.type, datablock);
			
			var tmp = "\t" + fullname + " AT " + datablock + " : " + mapping.type + ";\n";
			dbidx++;
			code += tmp;
		}
		
		// AXIS reference
		code += "	" + vprefix + " : AXIS_REF;\n";

		// driver reference
		code += "	" + vprefix + "driver : DRIVER_REF;\n";		
		var driver = DriverType(axisNode);
		var axis_name = AxisName(axisNode);
		code += 
"		_fb" +  axis_name + " : " + driver + ";\n";
		
		
		code += 'END_VAR\n\n';
		
		if (axis.type == MOTIONSLAVETYPE.ETHERCAT)
			AssignPLCVars_EtherCAT(axis, generatedVars);
	}
	
	// MC_Init program
	////////////////////
	
	var ethercatNodesPresent = false;
	
	code +=
"PROGRAM MC_Init WITH Init;\n\
\n\
PROGRAM MC_Init\n\
{ HIDDEN:ON }\n\
{ CODE:ST }\n\
\n";
		
	axisNodelist.reset();
	
	// Initialization for each Axis
	var id_axis = 0;
	while (axisNode = axisNodelist.nextNode())
	{
		var axisEnabled = axisNode.getAttribute("axisEnabled");
		if (axisEnabled == false)
			continue;

		var axis = Axis(axisNode,allAxes);
					
		// Motion vars generation
		var axis_name = AxisName(axisNode);
		var driver_name = DriverName(axisNode);
		code +=	axis_name + ".driver := REF(" + driver_name + ");\n";
		
		// mapped variables
		for (var i in axis.axisData.mappings)
		{
			code += driver_name + ".mp.adr_" + i + " := REF(" + axis_name + i + ");\n";
		}
		
		// Axis parameters
			// driver struct
		code += driver_name + ".Id := " + id_axis + ";\n";
		code += driver_name + ".state := MCD_SM_Disabled;\n";
		code += driver_name + ".di.command := MCD_CMD_NONE;\n";
		code += driver_name + ".di.response  := MCD_RESP_NONE;\n";
		code += driver_name + ".di.action := MCD_CMD_NONE;\n";
		
			// axis struct
		code += axis_name + ".Id := " + id_axis + ";\n";
		var periodUs = GetPLCCycleTimeMs() * 1000;
		if (periodUs == 0)
			periodUs = 1;
		var cycles_sec = 1000000.0 / periodUs;
		var timeUnit = axisNode.getAttribute("timeUnit");
		// cycles_sec is actually cycles / timeUnit
		if (timeUnit === 'usec')
		{
			cycles_sec = cycles_sec * 0.000001;						
		}
		else if (timeUnit === 'msec')
		{
			cycles_sec = cycles_sec * 0.001;			
		}
		else if (timeUnit === 'min')
		{
			cycles_sec = cycles_sec * 60;
		}
		else if (timeUnit === 'h')
		{
			cycles_sec = cycles_sec * 3600;			
		}
		
		code += axis_name + ".params.cycles_sec := TO_REAL(" + cycles_sec + ");\n";
		
		var pulses_rev = axisNode.getAttribute("roundSteps");
		var power = 0;
		var accum = 1;
		while (accum < pulses_rev)
		{
			accum *= 2.0;
			power += 1;
		}
		code += axis_name + ".params.pulses_rev := TO_REAL(" + pulses_rev + ");\n";
		code += axis_name + ".params.pow2_pulses_rev := " + power + ";\n";
			
		var min_enable = axisNode.getAttribute("minimumPositionEnabled");
		if (min_enable == true)
		{
			var min_eu = axisNode.getAttribute("minimumPositionValue");
		}
		else
		{
			var min_eu = DEFAULT_MIN_EU;
		}		
		code += axis_name + ".params.min_eu := TO_REAL(" + min_eu + ");\n";

		var max_enable = axisNode.getAttribute("maximumPositionEnabled");
		if (max_enable == true)
		{
			var max_eu = axisNode.getAttribute("maximumPositionValue");
		}
		else
		{
			var max_eu = DEFAULT_MAX_EU;
		}		
		code += axis_name + ".params.max_eu := TO_REAL(" + max_eu + ");\n";

		var units_rev = axisNode.getAttribute("roundUnit");
		var rNum =  axisNode.getAttribute("ratioNum");
		var rDen =  axisNode.getAttribute("ratioDen");
		units_rev *= rNum;
		if (rDen > 0.0)
		{
			units_rev /= rDen;			
		}
		code += axis_name + ".params.units_rev := TO_REAL(" + units_rev + ");\n";
		
		var numConstrained = axisNode.getAttribute("type");
		var isConstrained = false;
		if (numConstrained == 0)
			isConstrained = true;
		if (isConstrained)
		{
			code += axis_name + ".params.isConstrained := TRUE;\n";			
		}
		else
		{
			code += axis_name + ".params.isConstrained := FALSE;\n";						
		}
		
		// checkPositionMin : minimumPositionEnabled
		var minimumPositionEnabled = axisNode.getAttribute("minimumPositionEnabled");
		if (minimumPositionEnabled !== "0")
		{
			code += axis_name + ".params.checkPositionMin := TRUE;\n";			
		}
		else
		{
			code += axis_name + ".params.checkPositionMin := FALSE;\n";						
		}

		// checkPositionMax : maximumPositionEnabled
		var maximumPositionEnabled = axisNode.getAttribute("maximumPositionEnabled");
		if (maximumPositionEnabled !== "0")
		{
			code += axis_name + ".params.checkPositionMax := TRUE;\n";			
		}
		else
		{
			code += axis_name + ".params.checkPositionMax := FALSE;\n";						
		}

		// checkVelocityLimit : maximumVelocityEnabled
		var maximumVelocityEnabled = axisNode.getAttribute("maximumVelocityEnabled");
		if (maximumVelocityEnabled !== "0")
		{
			code += axis_name + ".params.checkVelocityLimit := TRUE;\n";			
		}
		else
		{
			code += axis_name + ".params.checkVelocityLimit := FALSE;\n";						
		}
		
		// checkAccelerationLimit : maximumAccelerationEnabled
		var maximumAccelerationEnabled = axisNode.getAttribute("maximumAccelerationEnabled");
		if (maximumAccelerationEnabled !== "0")
		{
			code += axis_name + ".params.checkAccelerationLimit := TRUE;\n";			
		}
		else
		{
			code += axis_name + ".params.checkAccelerationLimit := FALSE;\n";						
		}
		
		// checkDecelerationLimit : maximumDecelerationEnabled
		var maximumDecelerationEnabled = axisNode.getAttribute("maximumDecelerationEnabled");
		if (maximumDecelerationEnabled !== "0")
		{
			code += axis_name + ".params.checkDecelerationLimit := TRUE;\n";			
		}
		else
		{
			code += axis_name + ".params.checkDecelerationLimit := FALSE;\n";						
		}
		
		// maxVelocity_eu : maximumVelocityValue
		var maximumVelocityValue = axisNode.getAttribute("maximumVelocityValue");
		code += axis_name + ".params.maxVelocity_eu := TO_REAL(" + maximumVelocityValue + ");\n";
		
		// maxAcceleration_eu : maximumAccelerationValue
		var maximumAccelerationValue = axisNode.getAttribute("maximumAccelerationValue");
		code += axis_name + ".params.maxAcceleration_eu := TO_REAL(" + maximumAccelerationValue + ");\n";
		
		// maxDeceleration_eu : maximumDecelerationValue
		var maximumDecelerationValue = axisNode.getAttribute("maximumDecelerationValue");
		code += axis_name + ".params.maxDeceleration_eu := TO_REAL(" + maximumDecelerationValue + ");\n";
		
		// homing parameters
		var homingMethod = axisNode.getAttribute("homingMethod");
		code += axis_name + ".homing.hmMethod := TO_SINT(" + homingMethod + ");\n";
		var homingAcceleration = axisNode.getAttribute("homingAcceleration");
		code += axis_name + ".homing.hmAcceleration_eu := TO_REAL(" + homingAcceleration + ");\n";
		var homingSearchZeroVelocity = axisNode.getAttribute("homingSearchZeroVelocity");
		code += axis_name + ".homing.hmZeroVelocity_eu := TO_REAL(" + homingSearchZeroVelocity + ");\n";
		var homingSearchSwitchVelocity = axisNode.getAttribute("homingSearchSwitchVelocity");
		code += axis_name + ".homing.hmSwitchVelocity_eu := TO_REAL(" + homingSearchSwitchVelocity + ");\n";
		
		id_axis++;
		
		if (axis.type == MOTIONSLAVETYPE.ETHERCAT)
		{
			var fieldbusAddress = axis.slaveObj.PhysAddr;
			code += driver_name + ".fieldbusAddress := TO_UDINT(" + fieldbusAddress + ");\n";
			ethercatNodesPresent = true;
		}
	}

	code += "_motionLibraryInitialized := _MotionInitialize( 0 );\n\
END_PROGRAM\n\n";

	// MC_Fast program
	////////////////////

	code +=
"PROGRAM MC_Fast WITH Fast;\n\
\n\
PROGRAM MC_Fast\n\
{ HIDDEN:ON }\n\
	VAR \n\
		MCsequencer : _MCsequencer;\n\
		dummy : BOOL;\n";
	code += "END_VAR\n\n";
	code += "{ CODE:ST }\n\
\n";

	// Driver invocation for each axis
	axisNodelist.reset();
	while (axisNode = axisNodelist.nextNode())
	{

		var axisEnabled = axisNode.getAttribute("axisEnabled");
		if (axisEnabled == false)
			continue;
		
		// Motion vars generation
		axis_name = AxisName(axisNode);
		code += 
"dummy := _fb" +  axis_name + ".Execute(adr_axis := REF(" + axis_name + "));\n";
	}
	
	if (ethercatNodesPresent)
	{
		code +=
"_ecat_network_ok := sysEcatMasterStatus.network_ok;\n";		
	}
	
	code += "\n\n";
	
	
	// Sequencer invocation for each axis
	axisNodelist.reset();
	while (axisNode = axisNodelist.nextNode())
	{

		var axisEnabled = axisNode.getAttribute("axisEnabled");
		if (axisEnabled == false)
			continue;
		
		// Motion vars generation
		var axis_name = AxisName(axisNode);
		code += "MCsequencer(pAxis := REF(" + axis_name + "));\n\
WHILE NOT MCsequencer.Done DO\n\
	MCsequencer(pAxis := REF(" + axis_name + "));\n\
END_WHILE;\n";
	}

	code += "END_PROGRAM\n\n";

	// MC_Background program
	//////////////////////////

	code +=
"PROGRAM MC_Background WITH Background;\n\
\n\
PROGRAM MC_Background\n\
{ HIDDEN:ON }\n\
	VAR \n\
		dummy : BOOL;\n\
	END_VAR\n\n\
{ CODE:ST }\n\
\n";

	// Driver invocation for each axis
	axisNodelist.reset();
	while (axisNode = axisNodelist.nextNode())
	{

		var axisEnabled = axisNode.getAttribute("axisEnabled");
		if (axisEnabled == false)
			continue;
		
		// Motion vars generation
		axis_name = AxisName(axisNode);
		code += 
"dummy := _fb" +  axis_name + ".Background(adr_axis := REF(" + axis_name + "));\n";
	}
	
	code += "\n\n";	
	code += "END_PROGRAM\n\n";


	return code;
}


/* dato un deviceid, estrae dal suo PCT le info sugli assi motion, e ritorna
	[
		{
			name: string
			mappingsDS402: bool
			mappingsObjectIndexOffset: int (o null)
			drivers: [string]
			mappings: mappa name->
				{
					name: string
					index: int
					subindex: int
				}
		}
	]
*/
function GetMotionAxesDataFromPCT(deviceID)
{
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceID + "']/motionAxes");
	if (!nodelist || nodelist.length == 0)
		return [];
	
	var motionAxesNode = nodelist[0];
	var result = [];
	
	var axisNum = 0;
	var axisNodelist = motionAxesNode.selectNodes("axis");
	var axisNode;
	while (axisNode = axisNodelist.nextNode())
	{
		var axisData = {
			name: axisNode.getAttribute("name"),
			drivers: [],
			mappings: [],
			defaults: {}
		};
		
		var driverNodelist = axisNode.selectNodes("drivers/driver");
		var driverNode;
		while (driverNode = driverNodelist.nextNode())
			axisData.drivers.push(driverNode.text);
		
		var mappingsNode = axisNode.selectSingleNode("mappings");
		
		axisData.mappingsDS402 = genfuncs.ParseBoolean(mappingsNode.getAttribute("ds402"));
		
		if (!axisData.mappingsDS402)
		{
			// mappatura totalmente custom
			var mappingNodelist = mappingsNode.selectNodes("mapping");
			var mappingNode;
			while (mappingNode = mappingNodelist.nextNode())
			{
				var mapping = {
					name: mappingNode.getAttribute("name"),
					index: parseInt(mappingNode.getAttribute("index")),
					subindex: parseInt(mappingNode.getAttribute("subindex"))
				};
				
				// prende solo il tipo dalla definizione delle mappature standard, non indicato nel PCT
				var ds402map = DEFAULT_DS402_MAPPING[mapping.name];
				if (ds402map)
					mapping.type = ds402map.type;
				
				axisData.mappings[mapping.name] = mapping;
			}
		}
		else
		{
			// mappature ds402 standard, con offset per ogni asse
			axisData.mappingsObjectIndexOffset = mappingsNode.getAttribute("objectsIndexOffset");
			if (axisData.mappingsObjectIndexOffset !== null)
				axisData.mappingsObjectIndexOffset = parseInt(axisData.mappingsObjectIndexOffset);
			else
				axisData.mappingsObjectIndexOffset = DEFAULT_DS402_OBJECTINDEXOFFSET;
			
			for (var name in DEFAULT_DS402_MAPPING)
			{
				var ds402map = DEFAULT_DS402_MAPPING[name];
				var mapping = {
					name: name,
					index: ds402map.index + (axisData.mappingsObjectIndexOffset * axisNum),
					subindex: ds402map.subindex,
					type: ds402map.type
				};
				axisData.mappings[mapping.name] = mapping;
			}
		}
		
		// caricamento eventuali default per gli attributi delle nuove istanze di assi
		var defaultsNode = axisNode.selectSingleNode("defaults");
		if (defaultsNode)
		{
			for (var i = 0, t = defaultsNode.attributes.length; i < t; i++)
			{
				var attr = defaultsNode.attributes[i];
				axisData.defaults[attr.name] = attr.text;
			}
		}
		
		result.push(axisData);
		axisNum++;
	}
	
	return result;
}

/* ritorna una mappa con tutti gli slaves nel progetto predisposti per essere usati come assi del motion:
	mappa name->
		{
			name: string
			type: MOTIONSLAVETYPE
			axisData: oggetto ritornato da GetMotionAxesFromPCT
			slaveObj: oggetto slave
		}
*/
function GetAllMotionAxesFromProject()
{
	// mappa per evitare parsing e rircerche inutili per slave dello stesso tipo
	var axesDataMap = {};
	
	function ProcessSlave(slaveName, deviceID, type, slaveObj)
	{
		var axesData;
		if (!(deviceID in axesDataMap))
		{
			axesData = GetMotionAxesDataFromPCT(deviceID);
			axesDataMap[deviceID] = axesData;
		}
		else
			axesData = axesDataMap[deviceID];
		
		if (axesData)
		{
			for (var i = 0; i < axesData.length; i++)
			{
				var axis = {
					name: slaveName + " " + axesData[i].name,
					type: type,
					axisData: axesData[i],
					slaveObj: slaveObj
				};
				result[axis.name] = axis;
			}
		}
	}
	
	
	var result = {};
	
	// estrazione di tutti gli slaves EtherCAT
	var allSlaves = app.CallFunction("ECATCfg.GetAllEnabledSlaves");
	
	for (var i = 0; i < allSlaves.length; i++)
	{
		var slave = allSlaves[i];
		ProcessSlave(slave.Name, slave.Template.DeviceID, MOTIONSLAVETYPE.ETHERCAT, slave);
	}
	
	return result;
}

// estrae le variabili presenti nell'aux src del motion e li aggiunge a mappedVars
// necessario per permettere ai fieldbus di identificare e verificare le mappature
function GetMappedMotionVars(mappedVars)
{
	var list = app.CallFunction("logiclab.GetAuxSrcVariables", MOTION_PLC_FILENAME);
	for (var i = 0, t = list.length; i < t; i++)
	{
		var v = list.item(i);
		
		if (v.IsDataBlock)
			mappedVars[v.Name] = v;
	}
}

function AssignPLCVars_EtherCAT(axis, generatedVars)
{
	var FUNCNAME = "AssignPLCVars_EtherCAT";
	
	// costruzione stringa da salvare dentro ECATPDOEntry.PLCVariableInfo
	// come fa EncodePLCVarInfo in LLXPlugin_EtherCAT.js !
	function EncodePLCVarInfo(plcVar)
	{
		return plcVar.Datablock + "," + plcVar.Type;
	}
	
	var ECATslave = axis.slaveObj;
	for (var i = 0, it = ECATslave.PDOCount; i < it; i++)
	{
		var pdo = ECATslave.GetPDO(i);
		if (!pdo.Sm)
			continue;  // salta pdo non assegnati a syncManager
		
		for (var j = 0, jt = pdo.PDOEntriesCount; j < jt; j++)
		{
			var pdoEntry = pdo.GetPDOEntry(j);
			// se in questo pdo entry c'è uno degli oggetti CoE associati a variabili PLC generate, assegna la var PLC
			var genVar = generatedVars.FindVar(pdoEntry.Index, pdoEntry.SubIndex);
			if (genVar)
			{
				if (genVar.Type != pdoEntry.DataType)
				{
					var msg = genfuncs.FormatMsg(app.Translate("Invalid PDO Entry type: var %1 is %2, but obj is %3"), genVar.Name, genVar.Type, pdoEntry.DataType);
					CriticalError(msg, FUNCNAME);
				}

				pdoEntry.PLCVariable = genVar.Name;
				pdoEntry.PLCVariableInfo = EncodePLCVarInfo(genVar);
			}
		}
	}
}
