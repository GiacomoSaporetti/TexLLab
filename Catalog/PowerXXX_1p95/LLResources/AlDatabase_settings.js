//	utilizza datablock applicativi per l'immagine di parametri e status variables
//var USE_LOGICLAB_APPLICATION_DATABLOCK = false

//	di default è false ovvero il target è little endian
//	per metterlo big endian specificare negli attributi del target
//	<xs:attribute name="IsTargetBigEndian" type="xs:boolean" fixed="true"/>
//var ALDATABASE_IS_TARGET_BIG_ENDIAN = false

//	mettere true se il target supporta il web server
//	defaul false
//var ALDATABASE_GENERATE_MENUS = false

// Ridefinizione range degli indirizzi fisici e logici di default per l'assegnamento dei parametri
// Indirizzamento modbus compliant 
var m_params_AddressRangeModbus		= { start: 0x2000, end: 0x5FFF }
var m_paramsRO_AddressRangeModbus	= { start: 0x6000, end: 0x9FFF }

// Indirizzamento libero: NB 65000..65535 sono riservati per runtime PLC! 
var m_params_AddressRangeFree		= { start: 0x2000,      end: 0xEFFF }
var m_paramsRO_AddressRangeFree		= { start: 0x2000,      end: 0xEFFF }
/*
// Range degli IPA. ATTENZIONE non devono sovrapporsi a quelli di sistema (che quindi devono partire dal 20000 in poi)
var m_params_IpaRange				= { start:     0,  end:  9999 }
var m_paramsRO_IpaRange				= { start: 10000,  end: 19999 }
*/