var GRIDNAME = "AlDatabaseParamsRO"      // nome della griglia, usato in file INI
var tablePath    = "."					// path relativo della tabella
var rowTemplate  = "param"		// nome del template della riga
var gridDatapath = ""
var m_extName
var m_addressRange
var m_ipaRange
var m_parentDevice
var IS_PARAMS = false
var m_globalGroupName = "$$Global Shared"

var columns 	 = {	ipa: 		 	0, 
						address:	 	1,
						addressHex:	 	2,
						subindex:		3,
						name: 		 	4, 
						typepar: 		5, 
						typetarg: 		6, 
						size:			7,
						value:		 	8,
						min:		 	9, 
						max:		 	10, 
						scale:		 	11, 
						offs:		 	12,
						um:			 	13,
						form:		 	14,
						accesslevel: 	15,
						readonly:	 	16,
						description: 	17, 
						note:		 	18
/*						label:		 	19,
						translation: 	20,
						visibility:	 	21,
						clientType:	 	22*/
					}

var m_columnsNodes = []
var gridErrorPos   = { row: -1, col: -1 }


function InitGrid(datapath)
{	
	for (var i in columns)
		m_columnsNodes.push(i)

	// risale al device padre e ottiene il nome dell'estensione
	m_parentDevice = app.SelectNodesXML(datapath + ".")[0]
	m_parentDevice = m_parentDevice.selectSingleNode(XPATH_ROOTDEVICE)
	m_extName = m_parentDevice.getAttribute("ExtensionName")
	
	m_addressRange = app.CallFunction(m_extName + ".GetParamsROAddressRange")
	m_ipaRange     = app.CallFunction(m_extName + ".GetParamsROIpaRange")
	
	// creo due griglie diverse per gestire o meno il subindex
	if(m_isModbusCompliantDatabase)
		var GRIDNAME = "AlDatabaseParams_MBCompliant" 
	else
		var GRIDNAME = "AlDatabaseParams_FreeIndex" 
	
	CreateEnums(grid, datapath)
	grid.AddEnum( "clientTypeEnum", app.CallFunction(m_extName + ".GetClientTypeEnum"))
	
		//	Aggiungo le colonne
	grid.AddColumn(   0, 100, false,  true, egColumnType.egEdit,  		0, app.Translate("IPA") )
	if(m_isModbusCompliantDatabase)
	{
		grid.AddColumn(	  80,   100, false,  true, egColumnType.egEdit, 0, app.Translate("Address (dec)") )		// OK
		grid.AddColumn(   80,   100, false, false, egColumnType.egEdit, 0, app.Translate("Address (hex)") )		// OK
		grid.AddColumn(    0,     3, false, true,  egColumnType.egEdit, 0, app.Translate("SubIndex") )			// RIMOSSO
	}
	else
	{
		grid.AddColumn(	  80,   100, false,  true, egColumnType.egEdit, 0, app.Translate("Index") )				// Colonna Address rinominata in Index
		grid.AddColumn(    0,   100, false, false, egColumnType.egEdit, 0, app.Translate("Address (hex)") )		// RIMOSSO
		grid.AddColumn(   80,     3, false,  true, egColumnType.egEdit, 0, app.Translate("SubIndex") )			// OK
	}
	grid.AddColumn( 150, 100, false, false, egColumnType.egEdit,  		0, app.Translate("Name") )
	grid.AddColumn( 100, 100, false, false, egColumnType.egCombo,		0, app.Translate("Parameter type"), "typeparEnum" )		//	usato per il calcolo della dimensione del parametro, il configuratore usa questo tipo
	grid.AddColumn( 100, 100, false, false, egColumnType.egComboText,	0, app.Translate("PLC type"), "typetargEnum" )			//	usato a livello applicativo
	grid.AddColumn(  40,   4, false,  true, egColumnType.egEdit,  		0, app.Translate("Size") )
	grid.AddColumn(  90, 100, false, false, egColumnType.egMix,  		0, app.Translate("Default value") )
	grid.AddColumn( 140, 100, false, false, egColumnType.egComboTextEdit, 0, app.Translate("Min") )
	grid.AddColumn( 140, 100, false, false, egColumnType.egComboTextEdit, 0, app.Translate("Max") )
	grid.AddColumn(  80, 100, false,  true, egColumnType.egEdit,  		0, app.Translate("Scale") )
	grid.AddColumn(  80, 100, false,  true, egColumnType.egEdit,  		0, app.Translate("Offset") )
	grid.AddColumn(  80, 100, false, false, egColumnType.egComboTextEdit, 0, app.Translate("Unit"), "unitEnum" )
	grid.AddColumn(  80, 100, false, false, egColumnType.egComboTextEdit, 0, app.Translate("Format") )
	grid.AddColumn( 100, 100, false, false, egColumnType.egCombo,  		0, app.Translate("AccessLevel"), "accessLevelEnum" )
	grid.AddColumn(  80, 100, false, false, egColumnType.egCombo,  		0, app.Translate("Read only"), "BOOL" )
	grid.AddColumn( 300, 100, false, false, egColumnType.egEdit,  		0, app.Translate("Description") )
	grid.AddColumn( 300, 100, false, false, egColumnType.egEdit,  		0, app.Translate("Note") )
/*	grid.AddColumn( 140, 100, false, false, egColumnType.egEdit,  		0, app.Translate("Label") )
	grid.AddColumn( 140, 100, false, false, egColumnType.egEdit,  		0, app.Translate("Translation") )
	grid.AddColumn( 140, 100, false, false, egColumnType.egCombo,  		0, app.Translate("Visibility") , "BOOL")
	grid.AddColumn( 140, 100, false, false, egColumnType.egCombo,  		0, app.Translate("Client Type") , "clientTypeEnum")*/

	gridDatapath = datapath + tablePath
	grid.Init()
	
	GridLoadSettings(grid, GRIDNAME)
	
	RestoreGridSort( grid, gridDatapath )
		//	Gestione evidenziamento errore
	gridErrorPos = SearchErrorTable( grid, gridDatapath, m_columnsNodes )
}

function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}
