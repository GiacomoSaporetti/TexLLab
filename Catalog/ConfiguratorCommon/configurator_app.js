// --------------------------------------------------- GENERAZIONE PCT APPLICATIVO  ---------------------------------------------------
var m_fso = new ActiveXObject("Scripting.FileSystemObject")
var m_LogicLabTypes = app.CallFunction("script.GetLogicLabTypes")

var MODBUS_PROT_NAME = "Modbus"
var CANOPEN_PROT_NAME = "CanOpen"
var GDB_PROT_NAME = "GDB"

var APPLICATIONS_PATH = "Applications\\"
var MODBUSCUSTOM_PATH = "ModbusCustom\\"
var CANCUSTOM_PATH = "CANcustom\\"

var APP_TEMPLATEFILEATTRIBUTE = "AppTemplateFile"	//	utilizzato per il configuratore
var APP_ICONATTRIBUTE = "AppIcon"					//	utilizzato per il configuratore
var MODBUSCUSTOM_TEMPLATEFILEATTRIBUTE = "ModbusCustomTemplateFile"	//	template per esportazione come modbus custom slave
var CANCUSTOM_TEMPLATEFILEATTRIBUTE = "CANcustomTemplateFile"		//	template per esportazione come can custom slave
var MODBUSSLAVE_EXPORTCONFIGURATIONFUNC = "ModbusSlaveExportConfigurationFunc"		//	attributo funzione utilizzata per l'esportazione della configurazione modbus custom slave
var CANOPENSLAVE_EXPORTCONFIGURATIONFUNC = "CANopenSlaveExportConfigurationFunc"	//	attributo funzione utilizzata per l'esportazione della configurazione can custom slave

var MODBUS_PROTOCOLS_ALLOWED = [ MODBUS_PROT_NAME ]
var CANOPEN_PROTOCOLS_ALLOWED = [ CANOPEN_PROT_NAME ]
var CONFIGURATOR_PROTOCOLS_ALLOWED = [ MODBUS_PROT_NAME, GDB_PROT_NAME ]

var MODE_APP_CONFIGURATOR = 0
var MODE_EXP_MODBUS_CUSTOM = 1
var MODE_EXP_CAN_CUSTOM = 2

//	se il database supporta scala e offset il PLK viene generato con queste informazioni
//	nel PCT scala dovrà valere sempre 1 e offset 0 (le conversioni sono fatte nel database nella sysSetPar e sysGetPar)
//	il Device Type (typepar) determina sia typepar che typetarg del PCT generato
//	solo nel caso di enumerativi typepar="enum123" --> si avrà typetarg="int" e typepar="enum123" nel PCT del configuratore 
var TARGET_DATABASE_MANAGE_SCALE_OFFSET = true
//	true se sono gestiti separatamente typepar/typetarg (con doppia scelta da parte dell'utente), false se gestione unica del tipo (typetarg)
var TARGET_DATABASE_MANAGE_TYPEPAR = true;

// conversione in tipi usati dal PCT
// ATTENZIONE: definiti sia in configurator_app.js che in paramsDB_cfg.js di LLExec!
var m_TypeParToCfg = { 0:"short", 1:"int", 2:"unsignedShort", 3:"unsignedInt", 4:"float", 5:"boolean", 6: "char", 7:"unsignedChar", 8:"string" }
var m_TypeTargToCfg = { "INT":"short", "DINT":"int", "WORD":"unsignedShort", "DWORD":"unsignedInt", "REAL":"float", "BOOL":"boolean", "STRING":"string",
						"SINT":"char", "BYTE":"unsignedChar", "USINT":"unsignedChar", "UINT":"unsignedShort", "UDINT":"unsignedInt" }
var TYPEPAR_AUTO = -1;

var PATH_PARAMSRO = "config/paramsRO/param"
var PATH_PARAMS   = "config/params/param"
var PATH_MENUS    = "config/menus/menu"
var PATH_CUSTOMPAGE = "config/menus/custompage"
var PATH_ENUMS_NODE = "config/enums"
var PATH_ENUMS      = "config/enums/enum"
var PATH_SYSENUMS   = "config/sysenums/enum"

var PCT_EXT = ".PCT";

// modifiche al CFN prima di salvarlo
function CFNUpdate(xmlDocCFN, srcNode, deviceNode)
{
	// crea e associa l'applicazione
	var result = BuildApplication(srcNode, true)
	if (!result)
		return false
	
    var nextIDNode = xmlDocCFN.selectSingleNode("/configuration/data/project_config/@nextID")
	
	// se export ok genera il nodo <application> che linka la nuova applicazione esportata
	var deviceNode = xmlDocCFN.selectSingleNode("//application")
	var newnode = deviceNode.appendChild(xmlDocCFN.createElement(result.deviceid))
	// CFN con PCT esterno, nella stessa cartella nel PCN
	newnode.setAttribute("template", "%PCNPATH%\\" + result.prjname + PCT_EXT)
	newnode.setAttribute("version", "1.0")
	newnode.setAttribute("name", result.deviceid)
	newnode.setAttribute("caption", result.prjname)
	newnode.setAttribute("uniqueID", nextIDNode.text)
	nextIDNode.text++

	// scrive nel nuovo CFN la stringa di comunicazione (se presente)
	// in LogicLab c'è GDB, il configuratore usa quella impostata nel PCT (Modbus)
	var commstring = app.CallFunction("logiclab.get_CommString")
	var deviceNode = xmlDocCFN.selectSingleNode("//commstring")
	if (commstring && deviceNode)
		deviceNode.text = commstring
		
	// generazione del file .parx come input per pagelab per il caricamento dei parametri,
	// solo se definito l'attributo PageLabPrjGenFunc
	if(srcNode.getAttribute("PageLabPrjGenFunc"))
	{
		var xmlBase = app.CallFunction("ConfiguratorIntf.GetDeviceTemplateXML", srcNode.nodeName)
		BuildParametersForHMI( xmlBase, result.templateXMLDoc )
	}

	return true
}

function GetDeviceIDForPLCApplication(plcPrjFullPath)
{
	var prjname = m_fso.GetBaseName(plcPrjFullPath)
	
	var version = app.CallFunction("logiclab.get_ProjectVersionString")
	if (!version)
		version = "0.0"

	var deviceid = app.CallFunction("common.NormalizeName", prjname + "_" + version)
	return deviceid;
}

// cartella locale che contiene i sorgenti RSM
var APP_DIR_SRC = "RSM\\";
var APP_DIR_SRC_HMI = APP_DIR_SRC + "HMI\\";
var APP_DIR_IMG = "img";
var APP_DIR_HTML = "html";

// costruzione file PCT dell'applicazione corrente
function BuildApplication(device, embedRSM, mode, plcPrjFullPath)
{
	var exportFuncAttribute
	var templateFileAttribute
	var templatePath
	var protocols = []
	var addressFilter
	
	//	se non specificato diversamente esporta per il configuratore LV2
	if ( !mode )
		mode = MODE_APP_CONFIGURATOR
	
	switch ( mode )
	{
	case MODE_APP_CONFIGURATOR:
		templatePath = APPLICATIONS_PATH
		templateFileAttribute = APP_TEMPLATEFILEATTRIBUTE
		protocols = CONFIGURATOR_PROTOCOLS_ALLOWED
		break;
	
	case MODE_EXP_MODBUS_CUSTOM:
		templatePath = MODBUSCUSTOM_PATH
		templateFileAttribute = MODBUSCUSTOM_TEMPLATEFILEATTRIBUTE
		exportFuncAttribute = MODBUSSLAVE_EXPORTCONFIGURATIONFUNC
		protocols = MODBUS_PROTOCOLS_ALLOWED
		break;
	
	case MODE_EXP_CAN_CUSTOM:
		templatePath = CANCUSTOM_PATH
		templateFileAttribute = CANCUSTOM_TEMPLATEFILEATTRIBUTE
		exportFuncAttribute = CANOPENSLAVE_EXPORTCONFIGURATIONFUNC
		protocols = CANOPEN_PROTOCOLS_ALLOWED
		addressFilter = { fromAddress: 0x2000, toAddress: 0xFFFF }
		break;
		
	default:
		app.PrintMessage(app.Translate("ERROR: Export mode not supported"), enuLogLevels.LEV_CRITICAL)
		return
	}
	
	// nome del file sorgente, template per applicazione: letto dall'attributo AppTemplateFile
	var templDevice = app.CatalogPath + device.getAttribute("template")
	var templ = m_fso.GetParentFolderName(templDevice) + "\\" + device.getAttribute( templateFileAttribute )	
	
	// carica il template
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
	xmldoc.async = false
	if (!xmldoc.load(templ))
	{
		app.PrintMessage(app.Translate("ERROR: Can not load application template from ") + templ, enuLogLevels.LEV_CRITICAL)
		return
	}
	
	var generatedEnums = BuildAppEnums(device, xmldoc, "/devicetemplate/deviceconfig/enums")
	if ( mode == MODE_APP_CONFIGURATOR )
		BuildAppMenus(device, xmldoc)
	BuildAppParams(device, xmldoc, false, generatedEnums, protocols, addressFilter)
	BuildAppParams(device, xmldoc, true, generatedEnums, protocols, addressFilter)

	if (!plcPrjFullPath)
		plcPrjFullPath = app.CallFunction("logiclab.get_ProjectPath");
	
	// crea deviceid, deve essere un nome di nodo xml valido!
	var prjname = m_fso.GetBaseName(plcPrjFullPath)
	var prjrelease = app.CallFunction( "logiclab.get_ProjectReleaseString" )
	if (!prjrelease)
		prjrelease = prjname
	var version = app.CallFunction("logiclab.get_ProjectVersionString")
	if (!version)
		version = "0.0"
	var destpath = m_fso.GetParentFolderName(plcPrjFullPath) + "\\"

	// imposta informazioni in output
	
	var result = {}	
	result.prjname = prjname
	result.version = version	
	result.templateXMLDoc = xmldoc

	if ( mode == MODE_APP_CONFIGURATOR )
	{
		var deviceid = GetDeviceIDForPLCApplication(plcPrjFullPath);
		result.deviceid = deviceid
		result.basename = prjname
		result.templatePath = templatePath + deviceid + "\\" + result.basename + PCT_EXT
		result.localTemplatePath = destpath + result.basename + PCT_EXT
		result.RSMPath = templatePath + deviceid + "\\" + APP_DIR_SRC + result.basename + ".RSM"	//	RSM a catalogo
		result.PLKPath = templatePath + deviceid + "\\" + APP_DIR_SRC + result.basename + ".PLK"	//	PLK a catalogo
		result.localRSMPath = destpath + APP_DIR_SRC + result.basename + ".RSM"				//	RSM copia locale destinazione
		result.localPLKPathSrc = destpath + result.basename + ".PLK"					//	PLK sorgente locale
		result.localPLKPathDest = destpath + APP_DIR_SRC + result.basename + ".PLK"			//	PLK destinazione locale
		result.iconPath = m_fso.GetParentFolderName(templDevice) + "\\" + device.getAttribute( APP_ICONATTRIBUTE )
	}
	else if ( mode == MODE_EXP_MODBUS_CUSTOM )
	{
		var deviceid = app.CallFunction("common.NormalizeName", prjname + "_ModbusCustom_" + version)
		result.deviceid = deviceid
		result.basename = prjname + "_" + version
		result.templatePath = templatePath + "\\" + result.basename + PCT_EXT
		result.localTemplatePath = destpath + result.basename + PCT_EXT
	}
	else if ( mode == MODE_EXP_CAN_CUSTOM )
	{
		var deviceid = app.CallFunction("common.NormalizeName", "CANcustom_" + prjname + "_" + version)
		result.deviceid = deviceid
		result.basename = prjname + "_" + version
		result.templatePath = templatePath + "\\" + result.basename + PCT_EXT
		result.localTemplatePath = destpath + result.basename + PCT_EXT
	}
	
	// modifica il commento (nodetype==8) con #DEFINE PREFIX inserendo il deviceid corretto
	var destnode = xmldoc.childNodes[1]
	if (destnode.nodeType == 8)
		destnode.text = destnode.text.replace("%s", deviceid)
	
	// scrive sezione deviceinfo per catalogmng
	destnode = xmldoc.selectSingleNode("/devicetemplate/deviceinfo")
	destnode.setAttribute("caption", prjrelease)
	destnode.setAttribute("name", prjrelease)
	destnode.setAttribute("deviceid", deviceid)
	destnode.setAttribute("version", version)
	
	// scrive description
	destnode = xmldoc.selectSingleNode("/devicetemplate/deviceinfo/description")
	destnode.text = prjname
	
	if ( mode == MODE_APP_CONFIGURATOR )
	{
		destnode = xmldoc.selectSingleNode("/devicetemplate/deviceinfo/protocols")
		var newnode = destnode.appendChild(xmldoc.createElement("protocol"))
		// se presente l'attributo AppType (tipicamente fixed) sul nodo radice usa quello, altrimenti genera con il suffisso _application
		if (device.getAttribute("AppType"))
			newnode.text = device.getAttribute("AppType")
		else
			newnode.text = device.nodeName + "_application"
		
		// settaggio caption per il nodo dell'albero
		destnode = xmldoc.selectSingleNode("/devicetemplate/deviceconfig/hmi/tree/node")
		if (destnode)
			destnode.setAttribute("caption", prjname)
		
		destnode = xmldoc.selectSingleNode("/devicetemplate/plcconfig/hmi/tree/node")
		if (destnode)
			destnode.setAttribute("caption", prjname)
		
		if ( embedRSM )
		{
			// valorizza l'attributo del PLCProject associato (path relativo al catalog),
			// nella parte <deviceconfig> per EWDevice
			app.CallFunction("common.AddXMLNamespace", xmldoc, "xmlns:xs='http://www.w3.org/2001/XMLSchema'");

			var destnode = xmldoc.selectSingleNode("/devicetemplate/deviceconfig/datadef//xs:attribute[@name='PLCProject']")
			if (destnode)
				// la posizione del RSM è relativa al PCT
				destnode.setAttribute("fixed", APP_DIR_SRC + prjname + ".RSM")
				
			if (typeof USE_ONESW_HMI != "undefined" && USE_ONESW_HMI)
			{
				// aggiunta del path del progetto HMI in formato RSM nel PCT
				var relRSMpath = APP_DIR_SRC_HMI + prjname + ".RSM";
				if (AppPCT_AddHMI(xmldoc, relRSMpath))
					result.localRSMPath_HMI = destpath + relRSMpath;
			}
		}
		
		// funzione custom per modifiche particolari al PCT prima di salvarlo
		var func = device.getAttribute("CustomAppBuildFunc")
		if (func)
			if (app.CallFunction(func, device, xmldoc) == enuLogLevels.LEV_CRITICAL)
				// la funzione custom ha deciso di annullare la generazione
				return
		
		if (embedRSM)
		{
			if( !m_fso.FolderExists( destpath + APP_DIR_SRC ) )
				m_fso.CreateFolder( destpath + APP_DIR_SRC ) // cartella sorgenti
			
			// salva il progetto in formato RSM
			if (app.CallFunction("extfunct.SaveProjectToRSMInternalPsw", result.localRSMPath ))
				app.PrintMessage(app.Translate("RSM correctly saved as ") + result.localRSMPath, enuLogLevels.LEV_INFO)
			else
				app.PrintMessage(app.Translate("ERROR saving RSM as ") + result.localRSMPath, enuLogLevels.LEV_INFO)
			
			//	se è presente il PLK del database lo copia nella cartella destinazione in cui ho messo l'RSM
			if( m_fso.FileExists( result.localPLKPathSrc ) )
				m_fso.CopyFile( result.localPLKPathSrc, result.localPLKPathDest, true)
		
			//creazione delle cartelle di html, immagini e sorgenti
			if( !m_fso.FolderExists( destpath + APP_DIR_IMG ) )
				m_fso.CreateFolder( destpath + APP_DIR_IMG ) // cartella immagini

			if( !m_fso.FolderExists( destpath + APP_DIR_HTML ) )
				m_fso.CreateFolder( destpath + APP_DIR_HTML ) // cartella html
			
			// copia di RSM del HMI (e dei suoi PLK)
			if (typeof USE_ONESW_HMI != "undefined" && USE_ONESW_HMI)
			{
				if (result.localRSMPath_HMI)
				{
					if( !m_fso.FolderExists( destpath + APP_DIR_SRC_HMI ) )
						m_fso.CreateFolder( destpath + APP_DIR_SRC_HMI ) // cartella sorgenti HMI
	
					// copia il progetto HMI in formato RSM (e anche i PLK) nella cartella src
					HMI_SaveRSM(result.localRSMPath_HMI);
				}
			}
		}
	}
	else if ( mode == MODE_EXP_MODBUS_CUSTOM )
	{
		var XPATH_DEVICEINFO_ICON = "/devicetemplate/deviceinfo/@icon"
		var XPATH_TREENODEICON = "/devicetemplate/plcconfig/hmi/tree/node/@icon"
		var XPATH_TREENODECAPTION = "/devicetemplate/plcconfig/hmi/tree/node/@caption"
	
		// copia deviceid in #define _prefix_
		for (var node = xmldoc.firstChild; node != null; node = node.nextSibling)
			if (node && node.nodeType == 8)   // NODE_COMMENT=8
			{
				// cerca il primo figlio commento
				node.text = " #DEFINE PREFIX " + deviceid + " "
				break
			}			

		SetNode( xmldoc, XPATH_DEVICEINFO_ICON, "modbus.ico" )
		SetNode( xmldoc, XPATH_TREENODEICON, "modbus.ico" )
		SetNode( xmldoc, XPATH_TREENODECAPTION, prjrelease )
		
		// 	applica la configurazione dello slave chiamando la funzione specifica indicata dal target
		//	di default è questa ModbusCustom.ModbusSlaveExportConfiguration
		var exportFunc = device.getAttribute( exportFuncAttribute )
		if ( !exportFunc )
			exportFunc = "ModbusCustom.ModbusSlaveExportConfiguration"
		
		var ris = app.CallFunction( exportFunc, xmldoc )
		if ( !ris ) return
	}
	else if ( mode == MODE_EXP_CAN_CUSTOM )
	{
		var XPATH_TREENODECAPTION = "/devicetemplate/plcconfig/hmi/tree/node/@caption"
		var XPATH_DEVICEINFO_EDITINGMODE = "/devicetemplate/deviceinfo/@editingEnabled"
	
		// copia deviceid in #define _prefix_
		for (var node = xmldoc.firstChild; node != null; node = node.nextSibling)
			if (node && node.nodeType == 8)   // NODE_COMMENT=8
			{
				// cerca il primo figlio commento
				node.text = " #DEFINE PREFIX " + deviceid + " "
				break
			}			

		SetNode( xmldoc, XPATH_TREENODECAPTION, prjrelease )
		SetNode( xmldoc, XPATH_DEVICEINFO_EDITINGMODE, "true" )
		
		//	applica la configurazione dello slave chiamando la funzione specifica indicata dal target, di default è qui
		//	di default è questa CANcustom.CANopenSlaveExportConfiguration
		var exportFunc = device.getAttribute( exportFuncAttribute )
		if ( !exportFunc )
			exportFunc = "CANcustom.CANopenSlaveExportConfiguration"
			
		var ris = app.CallFunction( exportFunc, xmldoc )
		if ( !ris ) return
	}

	// salva il nuovo PCT nella cartella del progetto
	try
	{
		xmldoc.save(result.localTemplatePath)
		app.PrintMessage(app.Translate("PCT correctly saved as ") + result.localTemplatePath, enuLogLevels.LEV_INFO)
	}
	catch (ex)
	{
		app.PrintMessage(app.Translate("ERROR saving PCT as ") + result.localTemplatePath, enuLogLevels.LEV_INFO)
	}

	return result
}


function BuildAppParams(node, xmldoc, paramsRO, generatedEnums, protocols, addressFilter)
{
	var FUNCNAME = "BuildAppParams"
	
	if ( !protocols )
		//	se non sono specificati i protocolli setta quello di default
		protocols = [ "Modbus" ];
		
	var isModbusCompliant = app.CallFunction(app.CallFunction("logiclab.get_TargetID") + ".IsModbusCompliantDatabase")	
	
	// ricrea nuovi parametri
	var parent = xmldoc.selectSingleNode("/devicetemplate/deviceconfig/parameters")
	
	var pars = node.selectNodes(paramsRO ? PATH_PARAMSRO : PATH_PARAMS)
	var par
	var ipaKey = 0
	while (par = pars.nextNode())
	{
		if ( addressFilter )
		{
			var address = parseInt(GetNode(par, "address"))
			if ( !( address >= addressFilter.fromAddress && address <= addressFilter.toAddress ) )
				continue
		}
		
		var newparam = xmldoc.createElement("par")
		// ipa è un id del parametro, non l'indirizzo di comunicazione!
		newparam.setAttribute("ipa", ipaKey++)	//	newparam.setAttribute("ipa", GetNode(par, "ipa"))
		// come nome visibile nel configuratore usa shortname se specificato, altrimenti name (var plc)
		var shortname = GetNode(par, "shortname")
		newparam.setAttribute("name", shortname ? shortname : GetNode(par, "name"))
		newparam.setAttribute("descr", GetNode(par, "description"))
		
		// conversione e verifica tipo target
		var PLCtype = GetNode(par, "typetarg")
		var typeparInt = parseInt(GetNode(par, "typepar"));
		var isEnum = false;
		var typetarg = m_TypeTargToCfg[PLCtype]
		if (typetarg == undefined)	//	si tratta di un enumerativo
		{
			if (PLCtype in generatedEnums)
			{
				isEnum = true;
				var typepar = "enum" + generatedEnums[PLCtype]
				newparam.setAttribute("typetarg", m_TypeTargToCfg.DINT)   // in LL gli enum sono sempre DINT
				newparam.setAttribute("typepar", typepar)
			}
			else
			{
				// non dovrebbe mai accadere...
				genfuncs.AddLog(enuLogLevels.LEV_ERROR, FUNCNAME, "Unknown target type '" + PLCtype + "' in parameter " + GetNode(par, "name"))
				continue
			}
		}
		else if (TARGET_DATABASE_MANAGE_TYPEPAR && typeparInt != TYPEPAR_AUTO)
		{
			//	il typepar è il tipo mostrato dal configuratore
			var typepar = m_TypeParToCfg[typeparInt];
			if (typepar === undefined)
			{
				//	si tratta di un enum (definito in resources tipo AlDatabase)?
				if ( typeparInt >= m_LogicLabTypes.ENUM_BASE )
				{
					var enumTypeId = typeparInt - m_LogicLabTypes.ENUM_BASE
					var enumNode = node.selectSingleNode( PATH_ENUMS + "[@id = " + enumTypeId + "] | " + PATH_SYSENUMS + "[@id = " + enumTypeId + "]" )
					if ( !enumNode )
					{
						// non dovrebbe mai accadere...
						genfuncs.AddLog(enuLogLevels.LEV_ERROR, FUNCNAME, "Unknown parameter type in parameter " + GetNode(par, "name"))
						continue						
					}
					else
					{
						var enumNodeName = enumNode.getAttribute( "caption" )
						if (enumNodeName in generatedEnums)
						{
							isEnum = true;
							typepar = "enum" + generatedEnums[enumNodeName]
						}
						else
						{
							// non dovrebbe mai accadere...
							genfuncs.AddLog(enuLogLevels.LEV_ERROR, FUNCNAME, "Unknown parameter type '" + enumNodeCaption + "' in parameter " + GetNode(par, "name"))
							continue
						}
					}
				}
				else
				{
					// non dovrebbe mai accadere...
					genfuncs.AddLog(enuLogLevels.LEV_ERROR, FUNCNAME, "Unknown parameter type in parameter " + GetNode(par, "name"))
					continue
				}
			}
			
			if ( !isEnum && TARGET_DATABASE_MANAGE_SCALE_OFFSET )
				//	il valore arriva già convertito al configuratore
				newparam.setAttribute("typetarg", typepar)
			else
				//	il configuratore si occupa di applicare scala e offset e di convertire il parametro
				newparam.setAttribute("typetarg", typetarg)
			
			//	il tipo da mostrare è sempre quello applicativo
			newparam.setAttribute("typepar", typepar)
		}
		else
		{
			// gestione tipo unica semplificata
			newparam.setAttribute("typepar", typetarg)
			newparam.setAttribute("typetarg", typetarg)
		}
		
		if (typetarg == "string")
			newparam.setAttribute("strsize", GetNodeText(par, "size"));
		
		// indirizzo di comunicazione (può essere diverso da ipa)
		for ( var i = 0; i < protocols.length; i++ )
		{
			var protocol = protocols[ i ]
			
			var newprot = newparam.appendChild(xmldoc.createElement("protocol"))
			newprot.setAttribute("name", protocol)
			
			if ( protocol == MODBUS_PROT_NAME )
			{
				newprot.setAttribute("commaddr", parseInt(GetNode(par, "address")) /* + MODBUS_ADDRESS_OFFSET */)
				if (typetarg == "string")
					// per stringhe in modbus il commsubindex è utilizzato per indicare la lunghezza in bytes della stringa
					newprot.setAttribute("commsubindex", GetNode(par, "size"))
				else
					newprot.setAttribute("commsubindex", 0)
			}
			else if (protocol == CANOPEN_PROT_NAME)
			{
				newprot.setAttribute("commaddr", parseInt(GetNode(par, "address")))
				newprot.setAttribute("commsubindex", GetNode(par, "subindex"))
				
				var newoption = newparam.appendChild(xmldoc.createElement("option"))
				newoption.setAttribute("optid", "AccessType")
				var readonly = genfuncs.ParseBoolean(GetNode(par, "readonly"))
				newoption.text = readonly ? "ro" : "rw"
				
				var newoption = newparam.appendChild(xmldoc.createElement("option"))
				newoption.setAttribute("optid", "PDOMapping")
				newoption.text = "1"
			}
			else if (protocol == GDB_PROT_NAME)
			{
				newprot.setAttribute("commaddr", parseInt(GetNode(par, "address")))
				newprot.setAttribute("commsubindex", GetNode(par, "subindex"))
			}
		}
		
		var readonly = genfuncs.ParseBoolean(GetNode(par, "readonly"))
		newparam.setAttribute("readonly", readonly ? "true" : "false")
		
		newparam.setAttribute("defval", GetNode(par, "value"))
		
		if (!isEnum)
		{
			if ( TARGET_DATABASE_MANAGE_SCALE_OFFSET )
			{
				//	il db sul target si occupa della scalatura
				//	il configuratore non fa scalature!
				newparam.setAttribute("scale", 1)
				newparam.setAttribute("offs", 0)
			}
			else	//	database senza scala e offset
			{
				// gestione scala, verifica di avere sempre un valore corretto o almeno 1
				var scale = parseFloat(GetNode(par, "scale"))
				if (!scale) scale = 1
					newparam.setAttribute("scale", scale)

				newparam.setAttribute("offs", GetNode(par, "offs"))
			}

			var format = GetNode(par, "form")
			if ( !format || format == "" )
			{
				// se tipi PLC byte/word/dword forza il formato hex con la larghezza corretta
				if (PLCtype == "BYTE")
					format = "%02X"
				else if (PLCtype == "WORD")
					format = "%04X"
				else if (PLCtype == "DWORD")
					format = "%08X"
			}
			newparam.setAttribute("form", format)
		}
		
		// unità di misura
		newparam.setAttribute("um", GetNode(par, "um"))
		
		// gestione min/max
		var min = GetNode(par, "min")
		if (min != "")
		{
			if (isNaN(min))
			{
				// stringa, nome di altro parametro
				var ipa = GetParIpaFromName(node, min)
				if (ipa != undefined)
					newparam.setAttribute("ipamin", ipa)
				else
				{
					genfuncs.AddLog(enuLogLevels.LEV_ERROR, FUNCNAME, "Invalid Minimum value: '" + min + "' in parameter " + GetNode(par, "name"))
					continue
				}
			}
			else
				// valore numerico semplice
				newparam.setAttribute("min", min)
		}
		
		var max = GetNode(par, "max")
		if (max != "")
		{
			if (isNaN(max))
			{
				// stringa, nome di altro parametro
				var ipa = GetParIpaFromName(node, max)
				if (ipa != undefined)
					newparam.setAttribute("ipamax", ipa)
				else
				{
					genfuncs.AddLog(enuLogLevels.LEV_ERROR, FUNCNAME, "Invalid Maximum value: '" + max + "' in parameter " + GetNode(par, "name"))
					continue
				}
			}
			else
				// valore numerico semplice
				newparam.setAttribute("max", max)
		}
		
		// estrae tutti i menu aventi come menuItem l'ipa corrente
		var query = "//menuItem[ipa = " + GetNode(par, "ipa") + "]"
		var menuItems = node.selectNodes(PATH_MENUS + "/.." + query )
		var menuItem
		while (menuItem = menuItems.nextNode())
		{
			var newmenu = newparam.appendChild(xmldoc.createElement("menu"))
			newmenu.setAttribute("id", menuItem.parentNode.parentNode.getAttribute("id"))
			newmenu.setAttribute("order", menuItem.getAttribute("order") )
		}

		var size = parseInt(GetNode(par, "size"))
		var typetarg = GetNode(par, "typetarg")
		if (size == 0 || typetarg == "STRING")
		{
			parent.appendChild(newparam)
		}
		else
		{
			// add all elements as single rows
			for (i = 0; i < size; i++)
			{
				var newparamClone = newparam.cloneNode(true)
				
				var name = newparamClone.getAttribute("name")
				var elemSize = GetModbusParamSize(par, isModbusCompliant)
				var modbusAddress = parseInt(GetNode(par, "address"))
				modbusAddress += (i * elemSize)
				
				var modbusProtocol = newparamClone.selectSingleNode("protocol[@name='Modbus']")
				if (modbusProtocol)
					modbusProtocol.setAttribute("commaddr", modbusAddress)
												
				newparam.setAttribute("ipa", ipaKey++)
				newparamClone.setAttribute("name", name + "[" + i + "]")
				
				parent.appendChild(newparamClone)
			}
		}
	}
}

function GetModbusParamSize(node, isModbusCompliant)
{
	var modbusSize
	if (isModbusCompliant)
	{
		var typepar = parseInt(GetNode(node, "typepar"))
		var typetarg
		if (app.CallFunction("script.IsStandardTypePar", typepar))
		{
			// se typepar standard tale tipo sarà usato anche per il typetarg, ne tiene conto per il calcolo della dimensione
			for (var i in TYPEPAR)
			{
				if (TYPEPAR[i] == typepar)
				{
					typetarg = i
					break
				}
			}
		}
		else
		{
			typetarg = "DINT"
		}
		
		modbusSize = app.CallFunction("parameters.GetModbusObjectSizeFromIEC", typetarg)
	}
	else
	{
		modbusSize = 1
	}
	
	return modbusSize
}

function GetParIpaFromName(root, name)
{
	// cerca tra i parametri applicativi
	var par = root.selectSingleNode(".//param[name = '" + name + "']/ipa")
	if (par)
		return parseInt(par.text)
}


function BuildAppRecursiveMenu( menu, xmldoc, destnode, isFirstLevel )
{
	var nameMenu = ""
	var icon = ""
	var prjname = m_fso.GetBaseName(app.CallFunction("logiclab.get_ProjectPath"))

	var newnode = xmldoc.createElement("node")
	destnode.appendChild( newnode )
	var caption = menu.getAttribute("caption")
	
	var idMenu = menu.getAttribute("id");
	if (idMenu === null)
	{
		// se l'id deve essere generato sul salvataggio del progetto (es. da paramsDB_cfg.js di LLExec)
		app.MessageBox( "Menu id must be already assigned", "Menus generation", gentypes.MSGBOX.MB_ICONEXCLAMATION )
	}
	
	if( menu.nodeName == "menu" ) 
	{
		if (!caption) caption = app.Translate( "New Menu" )
		nameMenu = "PREFIX_menu"

		newnode.setAttribute("STDGRIDICONS", "")
		newnode.setAttribute("window", "maingrid")

		// valorizza attributo "order" progressivo sui menuItem per riutilizzarlo dopo in BuildAppParams senza rifare query
		var menuItems = menu.selectNodes("menuItems/menuItem")
		var menuItem
		var order = 0
		while (menuItem = menuItems.nextNode())
		{
			menuItem.setAttribute("order", order)
			order++
		}
	}
	else if( menu.nodeName == "custompage" ) 
	{
		if (!caption) caption = app.Translate( "New Custom Page" )
		nameMenu = "PREFIX_custompage"

		var icon = menu.getAttribute( "icon" )
		if( !icon || icon == "" ) icon = "empty.ico"
		

		newnode.setAttribute("icon", APP_DIR_IMG + "\\" + icon )
		newnode.setAttribute("window", nameMenu + idMenu )

			//creazione della window
		var destnodeCustom = xmldoc.selectSingleNode("/devicetemplate/deviceconfig/hmi")
		var newnodeWindow = destnodeCustom.insertBefore(xmldoc.createElement("window"), destnodeCustom.firstChild )
		newnodeWindow.setAttribute( "type", "html" )
		var link = menu.getAttribute( "link" )
		if( !link )
			link = "empty.html"
        newnodeWindow.setAttribute( "link", APP_DIR_HTML + "\\" + link )
		// attributi speciali per la gestione della pagine HTML agganciate a parametri
		newnodeWindow.setAttribute( "GLOBALWINDOWATTR", "" )
		newnodeWindow.text = nameMenu + idMenu
	}

	newnode.setAttribute("name", nameMenu + idMenu)
	newnode.setAttribute("caption", caption)
	newnode.setAttribute("data", isFirstLevel ? "../../config/values" : "..")
	
		//generazione sottomenù e custom pages
	var subMenus = menu.selectNodes("menu | custompage" )
	var subMenu
	while (subMenu = subMenus.nextNode())
		BuildAppRecursiveMenu( subMenu, xmldoc, newnode )
}

function BuildAppMenus(device, xmldoc)
{
	var destnodeFinal = xmldoc.selectSingleNode("/devicetemplate/deviceconfig/hmi/tree/node")
	var destnode = xmldoc.createElement("tempNode")
	var menus = device.selectNodes(PATH_MENUS + "|" + PATH_CUSTOMPAGE )
	var menu
	
	while (menu = menus.nextNode())
		BuildAppRecursiveMenu( menu, xmldoc, destnode, true )

	//al termine aggiungo la lista ottenuta a quello finale 
	var nodeList = destnode.childNodes
	var i = nodeList.length - 1
	for( ; i >=0; i--  ) 
		destnodeFinal.insertBefore( nodeList.item( i ), destnodeFinal.firstChild )
	
	
	// se nel template c'è anche una parte <plcconfig> per LL (onesw), duplica la struttura dei menu generata anche qui
	var plcDestnode = xmldoc.selectSingleNode("/devicetemplate/plcconfig/hmi/tree");
	if (plcDestnode)
		plcDestnode.appendChild(destnodeFinal.cloneNode(true));

	// duplica anche le eventuali <window>, derivanti da custompage
	var plcDestnode = xmldoc.selectSingleNode("/devicetemplate/plcconfig/hmi");
	if (plcDestnode)
	{
		nodeList = xmldoc.selectNodes("/devicetemplate/deviceconfig/hmi/window")
		while (node = nodeList.nextNode())
			plcDestnode.appendChild(node.cloneNode(true));
	}
}

/*	implementazione base per esportazione applicazione a catalogo per target di tipo firmware */
function ExportAppToCatalog( device )
{
	/*	BuildApplication (con valorizzazione path) */
	
	var appResult = BuildApplication( device, true )
	if (!appResult)
		return false
	
	/*	Controllo esistenza applicazione a catalogo */
	
	var destpath = m_fso.GetParentFolderName(app.CatalogPath + appResult.templatePath ) + "\\"
	var localPath = m_fso.GetParentFolderName(appResult.localTemplatePath ) + "\\"

	if( !m_fso.FolderExists( destpath ) )
		m_fso.CreateFolder( destpath )
	else
	{
		var msgris = app.MessageBox(app.Translate("Application already exists. Overwrite? "), "Overwrite", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_OKCANCEL)
		if (msgris == gentypes.MSGBOX.IDCANCEL)
			return false
	}
	
	/*	Copia immagini */
	
	// crea le directory locali img e html, quindi ci copia i files
	// invece che copiare la directory: in questo modo evito di copiare
	// le directory .svn
	if( !m_fso.FolderExists( destpath + APP_DIR_IMG) )
		m_fso.CreateFolder( destpath + APP_DIR_IMG)
	
	var copyError = false
	
	try
	{
		var imgFiles = m_fso.GetFolder( localPath + APP_DIR_IMG)
		var files = imgFiles.Files.Count
		if( files > 0 )
			m_fso.CopyFile(localPath + APP_DIR_IMG + "\\*", destpath + APP_DIR_IMG + "\\", true )
	}
	catch(ex)
	{
		var eMsg = genfuncs.FormatMsg(app.Translate("Error while copying file to '%1': %2"), destpath + APP_DIR_IMG + "\\", ex.description);
		app.PrintMessage( eMsg )
		copyError = true
	}
	
	/*	Copia icona di default se non è presente un'icona application.ico nella cartella immagini */

	try
	{
		//	se nella cartella non c'è una icona specifica
		if ( !m_fso.FileExists( localPath + APP_DIR_IMG + "\\application.ico" ) )
		{
			//	copia quella di default
			m_fso.CopyFile( appResult.iconPath, destpath + APP_DIR_IMG + "\\application.ico", true )		
		}
	}
	catch(ex)
	{
		var eMsg = app.Translate("Cannot copy application icon")
		app.PrintMessage( eMsg )
		copyError = true
	}
	
	//	altrimenti se esiste è già stata copiata al passaggio precedente
	
	/*	Copia pagine html */

	if( !m_fso.FolderExists( destpath + APP_DIR_HTML) )
		m_fso.CreateFolder( destpath + APP_DIR_HTML)
	
	try
	{
		var htmlFiles = m_fso.GetFolder( localPath + APP_DIR_HTML)
		var files = htmlFiles.Files.Count
		if( files > 0 )
			m_fso.CopyFile(localPath + APP_DIR_HTML + "\\*", destpath + APP_DIR_HTML + "\\", true )
	}
	catch(ex)
	{
		var eMsg = genfuncs.FormatMsg(app.Translate("Error while copying file to '%1': %2"), destpath + APP_DIR_HTML + "\\", ex.description)
		app.PrintMessage( eMsg )
		copyError = true
	}
	
	if ( copyError )
	{
		var caption = app.Translate("Cannot export application")
		app.MessageBox(app.Translate("Problems copying html or img folder.\nSee Resources tab for details."), caption, gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_OK)
		return false
	}
	
	/*	Copia PCT */
	
	// copia nel catalogo l'esito della generazione dell'applicazione in locale (sovrascrivendo files esistenti)
	m_fso.CopyFile(appResult.localTemplatePath, app.CatalogPath + appResult.templatePath, true)

	/*	Copia RSM in una sottocartella src sotto il PCT */

	if( !m_fso.FolderExists( destpath + APP_DIR_SRC) )
		m_fso.CreateFolder( destpath + APP_DIR_SRC )
	
	m_fso.CopyFile(appResult.localRSMPath, app.CatalogPath + appResult.RSMPath, true)
	
	/*	Copia PLK in una sottocartella src sotto il PCT */
	
	//	se esiste copia il PLK a catalogo (per implementazione firmware)
	if ( m_fso.FileExists( appResult.localPLKPathDest ) )
		m_fso.CopyFile(appResult.localPLKPathDest, app.CatalogPath + appResult.PLKPath, true)

	// export HMI
	if (appResult.localRSMPath_HMI && m_fso.FileExists(appResult.localRSMPath_HMI))
	{
		if( !m_fso.FolderExists( destpath + APP_DIR_SRC_HMI) )
			m_fso.CreateFolder( destpath + APP_DIR_SRC_HMI )
		
		m_fso.CopyFile(appResult.localRSMPath_HMI, destpath + APP_DIR_SRC_HMI, true);
		m_fso.CopyFile(m_fso.GetParentFolderName(appResult.localRSMPath_HMI) + "\\*.PLK", destpath + APP_DIR_SRC_HMI, true);
	}
	
	
	var func = device.getAttribute("ExportAppToCatalogFunc")
	if (func)
		if (app.CallFunction(func, device, appResult, destpath) == enuLogLevels.LEV_CRITICAL)
			return

	/* Reset cache */
	app.CallFunction("extfunct.ResetCatalogCache")
	
	var caption = app.Translate("Export application to catalog")
	var msg = app.Translate("Application exported to " + app.CatalogPath + appResult.templatePath)	
	app.PrintMessage( msg )
	
	app.MessageBox(msg, caption, gentypes.MSGBOX.MB_ICONINFORMATION|gentypes.MSGBOX.MB_OK)
	
	return true
}

function ExportAsModbusCustom(device, generateOnlyLocalPCT)
{
	var result = BuildApplication(device, false, MODE_EXP_MODBUS_CUSTOM)
	if (!result)
		return false
	
	if (generateOnlyLocalPCT)
	{
		var msg = app.Translate( "Application %1 %2 exported in project folder" ).replace( "%1", result.prjname ).replace( "%2", result.version )
		var caption = app.Translate( "Export database" )
		app.PrintMessage( msg )
		app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONINFORMATION )
		return true
	}
	
	//	file di destinazione
	var filename = app.CatalogPath + "ModbusCustom\\" + result.basename + PCT_EXT
	
	if (!app.CallFunction("ModbusCustom.IsValidDestinationPath", filename ))
		return false
	
	var name = result.prjname
	var version = result.version
	var deviceid = result.deviceid
	if (app.CallFunction("ModbusCustom.CheckCatalogDuplication", filename, name, version, deviceid, true) == enuLogLevels.LEV_CRITICAL)
		return false
	
	// copia nel catalogo l'esito della generazione dell'applicazione in locale (sovrascrivendo files esistenti)
	m_fso.CopyFile(result.localTemplatePath, app.CatalogPath + "ModbusCustom\\", true)
	
	// ricarica il catalogo se modifiche effettuate
	app.CallFunction("catalog.ResetCache", "")
	app.CallFunction("catalog.Load", app.CatalogPath)
	// rifresca il CatalogList
	app.CallFunction("common.OnTreeClick")
	// ricarica le definizioni dei parametri
	var modifiedDevicesArr = []
	modifiedDevicesArr.push( filename )
	app.CallFunction("ModbusCustom.ReloadAllDeviceParameters", modifiedDevicesArr)
	
	var msg = app.Translate( "Application %1 %2 exported as Modbus custom slave" ).replace( "%1", result.prjname ).replace( "%2", result.version )
	var caption = app.Translate( "Export Modbus slave" )
	app.PrintMessage( msg )
	app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONINFORMATION )	
	return true
}

function ExportAsCANcustom(device)
{
	var result = BuildApplication(device, false, MODE_EXP_CAN_CUSTOM)
	if (!result)
		return false
	
	//	file di destinazione
	var filename = app.CatalogPath + "CANcustom\\" + result.basename + PCT_EXT
	
	if (!app.CallFunction("CANcustom.IsValidDestinationPath", filename ))
		return false
	
	var name = result.prjname
	var version = result.version
	var deviceid = result.deviceid
	if (app.CallFunction("CANcustom.CheckCatalogDuplication", filename, name, version, deviceid, true) == enuLogLevels.LEV_CRITICAL)
		return false
	
	// copia nel catalogo l'esito della generazione dell'applicazione in locale (sovrascrivendo files esistenti)
	m_fso.CopyFile(result.localTemplatePath, app.CatalogPath + "CANcustom\\", true)
	
	// ricarica il catalogo se modifiche effettuate
	app.CallFunction("catalog.ResetCache", "")
	app.CallFunction("catalog.Load", app.CatalogPath)
	// rifresca il CatalogList
	app.CallFunction("common.OnTreeClick")
	// ricarica le definizioni dei parametri
	app.CallFunction("CANcustom.ReloadAllDeviceParameters")
		
	var msg = app.Translate( "Application %1 %2 exported as CANopen custom slave" ).replace( "%1", result.prjname ).replace( "%2", result.version )
	var caption = app.Translate( "Export CANopen slave" )
	app.PrintMessage( msg )
	app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONINFORMATION )	
	return true
}

function BuildAppEnums(device, xmldoc, parentXpath)
{
	var parent = xmldoc.selectSingleNode(parentXpath);

	// ritorna in output una mappa con nome enum -> id enum
	var generatedEnums = {}
	// gli ID degli enum applicativi partono da qui
	var id = 10000;
	
	var enumsNode = device.selectSingleNode( PATH_ENUMS_NODE )
	if ( enumsNode )
	{
		//	se definito nodo in cui vengono definiti enumerativi (esempio AlDatabase)
		var enumNodes = device.selectNodes( PATH_ENUMS + " | " + PATH_SYSENUMS)
		var enumNode
		while ( enumNode = enumNodes.nextNode() )
		{
			var enumName = enumNode.getAttribute( "caption" )
			var singleEnum = xmldoc.createElement("enum");
			singleEnum.setAttribute("id", id);
			
			var enumValueNodes = enumNode.selectNodes( "enum_value" )
			var enumValueNode
			while ( enumValueNode = enumValueNodes.nextNode() )
			{
				var elementName = genfuncs.GetNode( enumValueNode, "description" )
				if (!elementName)
					elementName = genfuncs.GetNode( enumValueNode, "name" );
				
				var elementValue = genfuncs.GetNode( enumValueNode, "value" )
				
				var enumVal = xmldoc.createElement("elem");
				enumVal.setAttribute("value", elementValue);
				enumVal.setAttribute("descr", elementName);
				singleEnum.appendChild(enumVal);
			}

			parent.appendChild(singleEnum);
			generatedEnums[enumName] = id;
			id++;
		}
	}
	else
	{
		// ottiene tutto l'elenco degli enum del progetto PLC
		var enumsSafearr = app.CallFunction("logiclab.QueryPrjSymbols", m_LogicLabTypes.PLCOBJ_TYPES.PLCOBJ_ENUM, m_LogicLabTypes.SYMLOC.symlProject, "", "");
		var enumsList = genfuncs.FromSafeArray(enumsSafearr);

		// cerca solo gli enum usati come tipi di parametri, per non esportarli tutti inutilmente
		var usedEnumsList = [];
		for (var i = 0; i < enumsList.length; i++)
		{
			var enumName = enumsList[i]
			var xpath = PATH_PARAMS   + "[typetarg = '" + enumName + "'] | " + 
						PATH_PARAMSRO + "[typetarg = '" + enumName + "']";
			if (device.selectSingleNode(xpath))
				usedEnumsList.push(enumName)
		}
		
		for (var i = 0; i < usedEnumsList.length; i++)
		{
			var singleEnum = xmldoc.createElement("enum");
			singleEnum.setAttribute("id", id);

			var enumName = usedEnumsList[i];
			var enumElements = app.CallFunction("logiclab.GetEnumElements", enumName);
			for (var el = 0; el < enumElements.Length; el++)
			{
				var enumElement = enumElements.Item(el);
				var elementName = enumElement.Description;
				if (!elementName)
					elementName = enumElement.Name;
				
				var elementValue = enumElement.InitValue;

				var enumVal = xmldoc.createElement("elem");
				enumVal.setAttribute("value", elementValue);
				enumVal.setAttribute("descr", elementName);
				singleEnum.appendChild(enumVal);
			}

			parent.appendChild(singleEnum);
			generatedEnums[enumName] = id;
			id++;
		}
	}

	return generatedEnums;
}
