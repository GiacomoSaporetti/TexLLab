/*
Il template 'generic' usa gli IPA standard, di conseguenza non serve alcuna inizializzazione!
Questo codice è presente per reference per l'implementazione di plugin successivi con indirizzi differenti
*/

var RTMODE = true 			//	modalità acquisizione continua disabilitata
var ALNGRAPH_MAXTRACKS = 8	//	numero di tracce

// IPA specifici di comunicazione
var m_commIPA = {
	Command		: 65120,
	Data		: 65122,
	TrgRqMode	: 65124,
	AcqID		: 65126,
	TrgStatus	: 65128,
	SampleCnt	: 65130,
	TrgPos		: 65132,
	AcqDoneID	: 65134,
	PLCCodeId	: 65002		//	IPA_PLC_APPL_ID
}

//	default target settings
var m_targetSettings = {
	trgMaxNumTracks		: 8,
	trgMaxNumSamples	: 1000,
	trgSampleTimeBase	: 10000000
}

function Init()
{
	// passa al core gli IPA di comunicazione da usare
	app.CallFunction("sscope.InitCommunicationIPA", m_commIPA)
	app.CallFunction("sscope.SetDefaultCommSettings", "ModbusTCP:255,1000,M#TCPIP:10.0.0.119/502,5000")
	app.CallFunction("sscope.SetDefaultTargetSettings", m_targetSettings) 
	return 1
}

function InitEmbedded()
{
	//	Passa al core gli IPA di comunicazione da usare
	app.CallFunction("sscope.InitCommunicationIPA", m_commIPA);
	//app.CallFunction("sscope.SetDefaultTargetSettings", m_targetSettings)

	return 1
}
