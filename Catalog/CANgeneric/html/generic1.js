var WINDOW_NAME = "CANgeneric1"
var m_parMap
var m_device
var m_oldPDOTxTransmission
var m_oldPDORxTransmission
var m_oldPDOMapping
var TREENAME = "tree1";
var m_treePath;

var PLCVARS_CONSTANTS

function InitPage()
{
	PLCVARS_CONSTANTS = GetConstants()
	nodeNumberVar_imgOut.src = csspath + '../img/arrowOut.png'
	nodeNumberVar_imgIn.src = csspath + '../img/arrowIn.png'
		
	// setta titolo e salva pagina corrente
	var path = window.external.GetCurrentWindowData()
	m_device = app.SelectNodesXML(path + ".")[0]
	
	// salva il percorso corrente dell'albero, in modo da settare la caption corretta se si cambia pagina cliccando sull'albero
	m_treePath = app.HMIGetCurElementPath(TREENAME);
	
	pageTitle.innerText = m_device.getAttribute("name") + " Configuration"
//	SaveActiveWindow(WINDOW_NAME)
	
	SearchError(path)
	
	var devinfo = app.CallFunction("CANgeneric.GetCANgenericDeviceInfo", m_device.nodeName)
	if (!devinfo) return
	
	if ( devinfo.hasDynamicPDO )
	{
		lblPDOMapping.innerText = app.Translate( "Variable PDO mapping allowed" )
		m_oldPDOMapping = ParseBoolean(app.DataGet(path + "CANgeneric_config/PDOAutoMapping", 0))
		PDOAutoMapping.checked = m_oldPDOMapping
		PDOAutoMapping.disabled = false
	}
	else
	{
		app.DataSet(path + "CANgeneric_config/PDOAutoMapping", 0, 0)
		lblPDOMapping.innerText = app.Translate( "Static PDO mapping" )
		PDOAutoMapping.checked = false
		PDOAutoMapping.disabled = true
	}

	if (!devinfo.isPDOTxSyncSupported)
		PDOTxTransmission_Sync.disabled = true
	if (!devinfo.isPDOTxEventSupported)
		PDOTxTransmission_Event.disabled = true
	if (!devinfo.isPDOTxCyclicSupported)
		PDOTxTransmission_Cyclic.disabled = true
	
	if (!devinfo.isPDORxSyncSupported)
		PDORxTransmission_Sync.disabled = true
	if (!devinfo.isPDORxEventSupported)
		PDORxTransmission_Event.disabled = true
	
	// elenco di tutti i parametri
	m_parMap = devinfo.parMap
	
	m_oldPDOTxTransmission = parseInt(app.DataGet(path + "CANgeneric_config/PDOTxTransmission", 0))
	m_oldPDORxTransmission = parseInt(app.DataGet(path + "CANgeneric_config/PDORxTransmission", 0))

	// disabilita funzionalità del master, guardando attributi sulla porta CANopen soprastante
	var parentPort = m_device.parentNode;
	if (parentPort.getAttribute("masterHearthbeatSupport") === "false")
	{
		rowHb1.style.display = "none";
		rowHb2.style.display = "none";
		rowHb3.style.display = "none";
	}
	
	if (parentPort.getAttribute("masterMandatorySupport") === "false")
		rowMandatory.style.display = "none";
		
	if (parentPort.getAttribute("masterIdentObjectSupport") === "false")
		identityObjectCheck.disabled = "disabled";
		
	//	target device supporta SDO scheduling?
	current_device = app.SelectNodesXML(window.external.GetCurrentWindowData() + ".")[0]
	var targetDevice  = current_device.selectSingleNode(XPATH_ROOTDEVICE)
	if ( parseInt(targetDevice.getAttribute( "CANopenSDOSchedulingSupported" )) > 0 )
		SDOSchedulingSupported.style.display = "block";
	else
		SDOSchedulingSupported.style.display = "none";
	
	//	target device supporta riconoscimento device?
	if ( targetDevice.getAttribute( "CANopenMasterIdentObjectSupportDisabled" ) === "true" )
	{
		identityObjectCheck.checked = false
		identityObjectCheck.disabled = "disabled"
	}
	
	//	target device supporta riconoscimento solo con bootup message oppure solo con polling del device id?
	if ( targetDevice.getAttribute( "CANopenMasterAttachOnBootupMessageOnly" ) === "true" )
	{
		waitBootUpMsg.checked = true
		waitBootUpMsg.disabled = "disabled"
	}
	else if ( targetDevice.getAttribute( "CANopenMasterAttachByPollingOnly" ) === "true" )
	{
		waitBootUpMsg.checked = false
		waitBootUpMsg.disabled = "disabled"
	}
}

function NodeNumberMode_OnClick( dyncfg )
{
	var path = app.GetCurrentWindowData()
	var isDyncfg = genfuncs.ParseBoolean( dyncfg )
	sectionStaticNodeIDCfg.style.display = isDyncfg ? "none" : ""
	sectionConfigurableNodeIDCfg.style.display = isDyncfg ? "" : "none"

	if ( isDyncfg )
	{
		//	setta il node number a 0
		var valueZero = "0"
		app.DataSet( path + "CANgeneric_config[1]/nodeNumber", 0, valueZero )

		initDiagnosticNode();
	}
	else
	{
		//	disassegna la variabile
		UnAssign( 'CANgeneric_config[1]/nodeNumberVar', nodeNumberVar )
	}
}

function UpdatePage()
{
	// l'init della diagnostica viene fatto qui (sull'evento di load) perche' pare che sulla InitPage sia troppo presto.
	// sembra infatti che alcuni elementi (ad es. dyncfgNodeNumberStatic e dyncfgNodeNumberParametric) non siano ancora stati valorizzati dal framework
	InitDiagnostics();

	var path = app.GetCurrentWindowData()
	
	var currentDevice = app.SelectNodesXML(path + ".")[0]
	var targetDevice  = currentDevice.selectSingleNode(XPATH_ROOTDEVICE)
	if ( ParseBoolean( targetDevice.getAttribute( "CANopenMasterDynamicCfgSupported" ) ) )
	{
		sectionNodeIDCfg.style.display = ""
		sectionStaticNodeIDCfg.style.display = "none"
		sectionConfigurableNodeIDCfg.style.display = ""
		
		var dyncfgMasterNodeID = app.DataGet(path + "/CANgeneric_config[1]/dyncfgNodeNumber[1]", 0)
		NodeNumberMode_OnClick( dyncfgMasterNodeID )
	}
	else
	{
		sectionNodeIDCfg.style.display = "none"
		sectionStaticNodeIDCfg.style.display = ""
		sectionConfigurableNodeIDCfg.style.display = "none"
	}
	
	if ( ParseBoolean( targetDevice.getAttribute( "CANopenPdoRxCycleSupported" ) ) )
	{
		 rowPDORxCycleNum1.style.display = ""
		 rowPDORxCycleNum2.style.display = ""
		 rowPDORxCycleNum3.style.display = ""
	}
	else
	{
		rowPDORxCycleNum1.style.display = "none"
		rowPDORxCycleNum2.style.display = "none"
		rowPDORxCycleNum3.style.display = "none"
	}
			
	PDOTxTransmission_OnChange()
	
	var idobjchk = ParseBoolean(app.DataGet(path + "CANgeneric_config/identityObjectCheck", 0))
	identityObjectCheck_OnChange(idobjchk)
}

var m_msg1 = window.external.Translate("WARNING: if you select this automatic mode you will lose your user defined PDO transmission settings.\nProceed?")
var m_msg2 = window.external.Translate("WARNING: PDO parametrization will be automatically regenerated to match PDO Tx and PDO Rx configuration.\nProceed?")

function PDOTxTransmission_OnChange(newvalue)
{
	var path = window.external.GetCurrentWindowData()

	if (newvalue != undefined)
	{
		// se specificato il nuovo valore e si sta uscendo dall'user defined chiede conferma
		if (m_oldPDOTxTransmission == -1 && newvalue != -1)
			if (app.MessageBox(m_msg1, "", 0x31) == 2)
			{
				// annullamento modifica
				PDOTxTransmission_Man.checked = true
				app.DataSet(path + "CANgeneric_config/PDOTxTransmission", 0, m_oldPDOTxTransmission)
				return
			}
			
		m_oldPDOTxTransmission = newvalue
	}
	
	PDOTxCyclicTime.disabled = !PDOTxTransmission_Cyclic.checked
	
	if (newvalue != undefined)
		app.CallFunction("CANgeneric.UpdatePDOTxTransmission", m_device, newvalue)
}

function PDORxTransmission_OnChange(newvalue)
{
	var path = window.external.GetCurrentWindowData()

	if (newvalue != undefined)
	{
		// se specificato il nuovo valore e si sta uscendo dall'user defined chiede conferma
		if (m_oldPDORxTransmission == -1 && newvalue != -1)
			if (app.MessageBox(m_msg1, "", 0x31) == 2)
			{
				// annullamento modifica
				PDORxTransmission_Man.checked = true
				app.DataSet(path + "CANgeneric_config/PDORxTransmission", 0, m_oldPDORxTransmission)
				return
			}
			
		m_oldPDORxTransmission = newvalue
	}
	
	if (newvalue != undefined)
		app.CallFunction("CANgeneric.UpdatePDORxTransmission", m_device, newvalue)
}

function PDOTxCyclicTime_OnChange()
{
	if (PDOTxCyclicTime.value != "")
		app.CallFunction("CANgeneric.UpdatePDOTxTransmission", m_device, PDOTxTransmission_Cyclic.value, PDOTxCyclicTime.value)
}

function PDOAutoMapping_OnChange(newvalue)
{
	if (newvalue != undefined)
	{
		// se specificato il nuovo valore e si sta uscendo dall'user defined chiede conferma
		if (m_oldPDOMapping == false && newvalue == true)
			if (app.MessageBox(m_msg2, "", 0x31) == 2)
			{
				// annullamento modifica
				PDOAutoMapping.checked = false
				return
			}
			
		m_oldPDOMapping = newvalue
	}
	
	if (newvalue == true)
	{
		app.CallFunction("CANgeneric.UpdatePDOMapping", m_device, "tx")
		app.CallFunction("CANgeneric.UpdatePDOMapping", m_device, "rx")
	}
}

function identityObjectCheck_OnChange(newvalue)
{
	if ( newvalue )
		fldIdentityObjectCheck.style.display = "block"
	else
		fldIdentityObjectCheck.style.display = "none"
}

function ValidateValue(ctrl)
{
	if ( ctrl.value != undefined && ctrl.value.length > 0 && !isNaN( ctrl.value ) )
	{
		//	forza formattazione in hex
		//var value = "0x" + parseInt( ctrl.value ).toString( 16 )
		//if ( ctrl.value != value ) ctrl.value = value
		return
	}
	else
		ctrl.value = "0x0"
}

function Assign( typeFilter, field, ctrlId )
{
	var item = AssignPLCVar_raw( typeFilter, "sysPluginsDataRW", ctrlId.value, 0, PLCVARS_CONSTANTS.PLCVARTYPES_SAMESIZE )
	if ( item )
	{
		ctrlId.value = item.name
		
		var path = app.GetCurrentWindowData()
		app.DataSet( path + field, 0, item.name )
	}

	initDiagnosticNode();
}

function UnAssign( field, ctrlId )
{
	var path = app.GetCurrentWindowData()
	var prevLabel = app.DataGet(path + field, 0)
	if (app.CallFunction("script.CanUnassignPLCVar", prevLabel, 0))
	{
		app.CallFunction("script.UnassignPLCVar", prevLabel )
	}

	app.DataSet( path + field, 0, "" )
	ctrlId.value = ""

	initDiagnosticNode();
}

function UpdateTreeCaption()
{
	// aggiorna la nuova caption sull'albero sull'elemento attivo
	app.HMISetCaption(TREENAME, m_treePath, txtCaption.value)
}
