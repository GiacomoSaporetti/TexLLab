var WINDOW_NAME = "CANcustom1"
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
	
	// ottiene deviceid (nome del nodo)
	var deviceid = m_device.nodeName
	// ottiene l'indirizzo dell'immagine dal catalog
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']/@image")
	if (nodelist && nodelist.length != 0)
		// attributo image trovato, imposta il path dell'immagine
		deviceImage.src = nodelist[0].text
	else
		// nessuna immagine, nasconde il tag <img>
		deviceImage.style.display = "none"
	
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']/longDescription")
	if (nodelist && nodelist.length != 0)
		// nodo longDescription trovato
		deviceDescription.innerText = nodelist[0].text
	else
		// nessuna longDescription, nasconde il fieldset
		deviceDescription.style.display = "none"
	
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']/@helpContext")
	if (nodelist && nodelist.length != 0)
	{
		// help context per manuale PDF
		m_helpContext = nodelist[0].text
		imgPDF.src = csspath + '../img/pdf_icon.png'
	}
	else
		// nessun help context, nasconde il link
		divHelp.style.display = "none"
	
	SearchError(path)
	// mostra versione firmware
	//fwver.innerText = app.CallFunction("EWConnection.GetDeviceVersion", path)
	
	var devinfo = app.CallFunction("CANcustom.GetCANCustomDeviceInfo", m_device.nodeName)
	if (!devinfo) return
	
	// PDO auto mapping abilitato solo se:
	// - l'utente ha scelto 'has variable pdo mapping' durante import EDS (informazione non deducibile da EDS!), ovvero che la mappatura non è fissa e deducibile da EDS
	// - l'EDS ha granularity != 0, che indica che i PDO sono rimappabili dinamicamente dal master
	if ( devinfo.hasDynamicPDO && devinfo.granularity != 0)
	{
		lblPDOMapping.innerText = app.Translate( "Variable PDO mapping allowed" )
		m_oldPDOMapping = ParseBoolean(app.DataGet(path + "CANcustom_config/PDOAutoMapping", 0))
		PDOAutoMapping.checked = m_oldPDOMapping
		PDOAutoMapping.disabled = false
	}
	else
	{
		app.DataSet(path + "CANcustom_config/PDOAutoMapping", 0, 0)
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
	
	m_oldPDOTxTransmission = parseInt(app.DataGet(path + "CANcustom_config/PDOTxTransmission", 0))
	m_oldPDORxTransmission = parseInt(app.DataGet(path + "CANcustom_config/PDORxTransmission", 0))
	
	// informazioni
	if ( devinfo.identityObjectCheck.deviceType != undefined && !isNaN( parseInt( devinfo.identityObjectCheck.deviceType ) ) )
		infoDeviceType.value = "0x" + parseInt( devinfo.identityObjectCheck.deviceType, 10 ).toString( 16 )
	if ( devinfo.identityObjectCheck.vendorID != undefined && !isNaN( parseInt( devinfo.identityObjectCheck.vendorID ) ) )
		infoVendorID.value = "0x" + parseInt( devinfo.identityObjectCheck.vendorID, 10 ).toString( 16 )
	if ( devinfo.identityObjectCheck.productCode != undefined && !isNaN( parseInt( devinfo.identityObjectCheck.productCode ) ) )
		infoProductCode.value = "0x" + parseInt( devinfo.identityObjectCheck.productCode, 10 ).toString( 16 )
	if ( devinfo.identityObjectCheck.revision != undefined && !isNaN( parseInt( devinfo.identityObjectCheck.revision ) ) )
		labelInfoRevisionDefault.innerText = "(0x" + parseInt(devinfo.identityObjectCheck.revision, 10).toString( 16 ) + ") **"
	else
		labelInfoRevisionDefault.innerText = ""
	if ( devinfo.identityObjectCheck.serial != undefined && !isNaN( parseInt( devinfo.identityObjectCheck.serial ) ) )
		labelInfoSerialDefault.innerText = "(0x" + parseInt(devinfo.identityObjectCheck.serial, 10).toString( 16 ) + ") **"
	else
		labelInfoSerialDefault.innerText = ""

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
		app.DataSet(path + "CANcustom_config/identityObjectCheck", 0, "false")
		identityObjectCheck.disabled = "disabled"
	}

	InitDiagnostics();
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
		app.DataSet( path + "CANcustom_config[1]/nodeNumber", 0, valueZero )

		initDiagnosticNode();
	}
	else
	{
		//	disassegna la variabile
		UnAssign( 'CANcustom_config[1]/nodeNumberVar', nodeNumberVar )
	}
}

function UpdatePage()
{
	var path = app.GetCurrentWindowData()
	
	var currentDevice = app.SelectNodesXML(path + ".")[0]
	var targetDevice  = currentDevice.selectSingleNode(XPATH_ROOTDEVICE)
	if ( ParseBoolean( targetDevice.getAttribute( "CANopenMasterDynamicCfgSupported" ) ) )
	{
		sectionNodeIDCfg.style.display = ""
		sectionStaticNodeIDCfg.style.display = "none"
		sectionConfigurableNodeIDCfg.style.display = ""
		
		var dyncfgMasterNodeID = app.DataGet(path + "/CANcustom_config[1]/dyncfgNodeNumber[1]", 0)
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
	
	var idobjchk = ParseBoolean(app.DataGet(path + "CANcustom_config/identityObjectCheck", 0))
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
				app.DataSet(path + "CANcustom_config/PDOTxTransmission", 0, m_oldPDOTxTransmission)
				return
			}
			
		m_oldPDOTxTransmission = newvalue
	}
	
	PDOTxCyclicTime.disabled = !PDOTxTransmission_Cyclic.checked
	
	if (newvalue != undefined)
		app.CallFunction("CANcustom.UpdatePDOTxTransmission", m_device, newvalue)
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
				app.DataSet(path + "CANcustom_config/PDORxTransmission", 0, m_oldPDORxTransmission)
				return
			}
			
		m_oldPDORxTransmission = newvalue
	}
	
	if (newvalue != undefined)
		app.CallFunction("CANcustom.UpdatePDORxTransmission", m_device, newvalue)
}

function PDOTxCyclicTime_OnChange()
{
	if (PDOTxCyclicTime.value != "")
		app.CallFunction("CANcustom.UpdatePDOTxTransmission", m_device, PDOTxTransmission_Cyclic.value, PDOTxCyclicTime.value)
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
		app.CallFunction("CANcustom.UpdatePDOMapping", m_device, "tx")
		app.CallFunction("CANcustom.UpdatePDOMapping", m_device, "rx")
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
