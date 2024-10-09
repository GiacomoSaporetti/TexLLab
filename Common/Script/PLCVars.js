var gentypes = app.CallFunction("common.GetGeneralTypes")
var genfuncs = app.CallFunction("common.GetGeneralFunctions")

// global flag to avoid recursion of CreateNewPLCVar; global assignment of grid.Elem() could cause this
var m_disableModifyPLCVarAssigment = false

// --- ATTVAR enum ---
var PLCVAR_ATTR_NONE = 0		//	atvNone
var PLCVAR_ATTR_RETAIN = 1		//	atvRetain
var PLCVAR_ATTR_CONST = 2		//	atvConst
var PLCVAR_ATTR_UNDEFINED = 3

// ---- flags for AssignPLCVar and ModifyPLCVarAssigment
// allows assignment of variables of the same exact type only
var PLCVARTYPES_FIXED = 0
// allows assignment of variables of the same size in bits (e.g. INT,UINT,WORD are the same)
var PLCVARTYPES_SAMESIZE = 1
// allows all types of variables
var PLCVARTYPES_ALL = 2

// allows assignment of automatic var only (that will be automatically mapped), does not allow reuse of vars already mapped
var PLCVARASSIGN_ONLYAUTO = 1
// allows use of scalar variables only, no array or strut
var PLCVARASSIGN_ONLYSIMPLE = 2
// allows selection of array variables
var PLCVARASSIGN_ALLOWARRAYS = 4
// hides the dialog for variable creation, creates them without confirmation
var PLCVARASSIGN_HIDEDIALOG = 8
// asks to delete an automatic variable after substitution of it
var PLCVARASSIGN_ASKDELETEAUTO = 16
// allows only arrays of the same specified size
var PLCVARASSIGN_SAMEARRAYSIZE = 32
// allow retain selection on dialog new var dialog
var PLCVARASSIGN_ALLOWRETAIN = 64
// allow assignment to %I* unspecified address
var PLCVARASSIGN_ALLOWUNSPEC_I = 128;
// allow assignment to %Q* unspecified address
var PLCVARASSIGN_ALLOWUNSPEC_Q = 256;
// allow assignment to %M* unspecified address
var PLCVARASSIGN_ALLOWUNSPEC_M = 512;
// allow assignment to any unspecified address I*/Q*/M*
var PLCVARASSIGN_ALLOWUNSPEC_ANY = PLCVARASSIGN_ALLOWUNSPEC_I | PLCVARASSIGN_ALLOWUNSPEC_Q | PLCVARASSIGN_ALLOWUNSPEC_M;
// allow only assignment to unspecified address
var PLCVARASSIGN_ONLYUNSPEC = 1024;
// check usage of variables (only if no datablock specified)
var PLCVARASSIGN_CHECKVARUSAGES = 2048;
// include all mapped target variables in assign list (only if datablock is not specified)
var PLCVARASSIGN_INCLUDE_TARGET_VARS = 4096;
// include all mapped library variables in assign list (only if datablock is not specified)
var PLCVARASSIGN_INCLUDE_LIBRARIES_VARS = 8192;
// include all variables for aux src in assign list (only if datablock is not specified)
var PLCVARASSIGN_INCLUDE_AUXSRC_VARS = 16384;

var UNSPEC_ADDR_I = "%I*";
var UNSPEC_ADDR_Q = "%Q*";
var UNSPEC_ADDR_M = "%M*";


function GetConstants()
{
	return {
		PLCVARTYPES_FIXED: PLCVARTYPES_FIXED,
		PLCVARTYPES_SAMESIZE: PLCVARTYPES_SAMESIZE,
		PLCVARTYPES_ALL: PLCVARTYPES_ALL,
		
		PLCVARASSIGN_ONLYAUTO: PLCVARASSIGN_ONLYAUTO,
		PLCVARASSIGN_ONLYSIMPLE: PLCVARASSIGN_ONLYSIMPLE,
		PLCVARASSIGN_ALLOWARRAYS: PLCVARASSIGN_ALLOWARRAYS,
		PLCVARASSIGN_HIDEDIALOG: PLCVARASSIGN_HIDEDIALOG,
		PLCVARASSIGN_ASKDELETEAUTO: PLCVARASSIGN_ASKDELETEAUTO,
		PLCVARASSIGN_SAMEARRAYSIZE: PLCVARASSIGN_SAMEARRAYSIZE,
		PLCVARASSIGN_ALLOWRETAIN : PLCVARASSIGN_ALLOWRETAIN,
		PLCVARASSIGN_ALLOWUNSPEC_I: PLCVARASSIGN_ALLOWUNSPEC_I,
		PLCVARASSIGN_ALLOWUNSPEC_Q: PLCVARASSIGN_ALLOWUNSPEC_Q,
		PLCVARASSIGN_ALLOWUNSPEC_M: PLCVARASSIGN_ALLOWUNSPEC_M,
		PLCVARASSIGN_ALLOWUNSPEC_ANY: PLCVARASSIGN_ALLOWUNSPEC_ANY,
		PLCVARASSIGN_ONLYUNSPEC: PLCVARASSIGN_ONLYUNSPEC,
		PLCVARASSIGN_CHECKVARUSAGES: PLCVARASSIGN_CHECKVARUSAGES,
		PLCVARASSIGN_INCLUDE_TARGET_VARS : PLCVARASSIGN_INCLUDE_TARGET_VARS,
		PLCVARASSIGN_INCLUDE_LIBRARIES_VARS : PLCVARASSIGN_INCLUDE_LIBRARIES_VARS,
		PLCVARASSIGN_INCLUDE_AUXSRC_VARS : PLCVARASSIGN_INCLUDE_AUXSRC_VARS
		
	}
}

function IsPLCArray(v)
{
	if (v.Type == "STRING" || v.Type == "WSTRING")
		return false   // array di stringhe non supportati!
	
	var dims = genfuncs.FromSafeArray(v.Dims)
	if (dims && dims.length > 0 && dims[0] > 0)
		// se la var ha una dimensione, potrebbe essere o l'array (es. arr) ma anche un elemento dell'array (es. arr[2])
		// questo perchè erroneamente LogicLab ritorna la CPlcVar cmq con le dimensioni anche se è un elemento!
		// testa quindi se il nome ha le parentesi [], se sì assume sia un elemento dell'array e non l'array stesso nella sua interezza!
		return v.Name.indexOf("[") == -1
	else
		return false
}

function IsUnspecifiedAddress(db)
{
	return db == UNSPEC_ADDR_I || db == UNSPEC_ADDR_Q || db == UNSPEC_ADDR_M;
}

function GetPLCVarSize(v)
{
	var size = 0;
	if (IsPLCArray(v) || v.Type == "STRING" || v.Type == "WSTRING")
	{
		// se la var è un array è perchè è stato passato il flag ALLOWARRAYS, altrimenti non sarebbe stata accettata
		var dims = genfuncs.FromSafeArray(v.Dims);
		if (dims && dims.length != 0 && dims[0] != 0)
		{
			size = dims[0];	//	sia STRING (non è più conteggiato il terminatore in dims[0]) che ARRAY
		}
	}
	
	return size
}

// assegna una variabile presa dalle globali del device master alla griglia specificata
// se dataBlock specificato, fa il browse di una automatica e la assegna al datablock, altrimenti fa un semplice browse senza modifiche
function AssignPLCVar(grid, columns, typeFilter, dataBlock, flags, allowedTypes, group)
{
	if (grid.NumRows == 0)
		return false
	
	var row = grid.SelectedRow
	var prevLabel = grid.Elem(row, columns.label)
	
	var item = AssignPLCVar_raw(typeFilter, dataBlock, prevLabel, flags, allowedTypes, group)
	if (!item)
		return false
	
	// setta i valori della riga
	m_disableModifyPLCVarAssigment = true
	grid.Elem(row, columns.label) = item.name
	m_disableModifyPLCVarAssigment = false
	
	if (columns.type != undefined)
		grid.Elem(row, columns.type) = item.type
		
	if (columns.dataBlock != undefined)
		grid.Elem(row, columns.dataBlock) = item.dataBlock
		
	if (columns.description != undefined)
		grid.Elem(row, columns.description) = item.description

	if (columns.size != undefined)
		grid.Elem(row, columns.size) = GetPLCVarSize(item);
	
	grid.Update(row, -1)
	return true
}

function CheckUnspecifiedAddress(db, flags)
{
	if ((flags & PLCVARASSIGN_ONLYUNSPEC) && !IsUnspecifiedAddress(db))
		return false;

	if ((db == UNSPEC_ADDR_I && !(flags & PLCVARASSIGN_ALLOWUNSPEC_I)) ||
		(db == UNSPEC_ADDR_Q && !(flags & PLCVARASSIGN_ALLOWUNSPEC_Q)) ||
		(db == UNSPEC_ADDR_M && !(flags & PLCVARASSIGN_ALLOWUNSPEC_M)))
		return false;
	
	return true;
}

/* shows a dialog to choose a variable to assign to datablock
 - typeFilter	: IEC type to use as filter, or undefined for no filter. If PLCVARASSIGN_SAMEARRAYSIZE is specified, this should contain the array size, e.g. INT[8]
 - dataBlock	: if specified, db where to assign the variable. It should be the NAME of variable representing the db (it will search for the first free slow), or a fixed db position
 - prevLabel	: previous variable, if specified it will be unassigned
 - flags		: bitmask of PLCVARASSIGN_xxx: are used PLCVARASSIGN_ALLOWARRAYS (whole array assignment), PLCVARASSIGN_ONLYAUTO (do not show flag for mapped variables reuse), PLCVARASSIGN_SAMEARRAYSIZE (only arrays with matching size)
 - allowedTypes	: options PLCVARTYPES_xxx, if different from PLCVARTYPES_ALL typeFilter is required
 - globalVarsGroup : name of global PLC var group to use. If not specified, will be "ungrouped vars"
*/
function AssignPLCVar_raw(typeFilter, dataBlock, prevLabel, flags, allowedTypes, globalVarsGroup)
{
	function CheckPLCVarCompatibility(v)
	{
		if (IsPLCArray(v))
		{
			if (!(flags & PLCVARASSIGN_ALLOWARRAYS))
				return false;  // var array ma flag ALLOWARRAYS non presente
			
			if ((flags & PLCVARASSIGN_SAMEARRAYSIZE) && GetPLCVarSize(v) != arraySize)
				return false;  // flag SAMEARRAYSIZE presente ma dimensioni errate
		}
		
		if (!bitFilter || (allowedTypes == PLCVARTYPES_ALL))
			return true;
		else if ( allowedTypes == PLCVARTYPES_SAMESIZE && bitFilter == v.NumBits )
			return true;
		else if ( allowedTypes == PLCVARTYPES_FIXED && typeFilter == v.Type )
			return true;
		else
			return false;
	}
	
	function AddVarsToList(varList, onlyMapped)
	{
		for (var i = 0, t = varList.length; i < t; i++)
		{
			var v = varList.item(i);
			
			if (onlyMapped && !v.DataBlock)
				continue;
			
			if (!CheckPLCVarCompatibility(v))
				continue;

			if (!CheckUnspecifiedAddress(v.DataBlock, flags))
				continue;

			if (allVarUsages)
			{
				if (!(v.name in allVarUsages))
					vars.push(v);
				
				allVars.push(v);
			}
			else
				vars.push(v);
		}
	}
	
	
	// se variabili globali già modificate e non salvate non permette l'operazione
	if (!app.CallFunction("script.CheckGlobalVarsModified", globalVarsGroup))
		return false
	
	//	per retrocompatibilità 
	if (allowedTypes == undefined)
		allowedTypes = PLCVARTYPES_SAMESIZE
	
	var bitFilter;
	var arraySize;
	if (typeFilter)
	{
		if (flags & PLCVARASSIGN_SAMEARRAYSIZE)
		{
			// se tra i flag c'è PLCVARASSIGN_SAMEARRAYSIZE, il filtro del tipo può essere del tipo INT[10]
			var pos1 = typeFilter.indexOf("[");
			var pos2 = typeFilter.indexOf("]");
			if (pos1 != -1 && pos2 != -1)
			{
				arraySize = parseInt(typeFilter.slice(pos1+1, pos2));
				typeFilter = typeFilter.substr(0, pos1);
			}
		}
		
		bitFilter = app.CallFunction("common.GetIECTypeBits", typeFilter);
	}
	
	// genera array con l'elenco delle variabili
	var vars = []
	var allVars
	var allVarUsages;
	
	// calcola subito l'uso di tutte le variabili, richiede funzione GetAllPLCVariableUsages del target. non ha senso usato con PLCVARASSIGN_ONLYAUTO!
	if (flags & PLCVARASSIGN_CHECKVARUSAGES)
	{
		allVars = [];
		allVarUsages = app.CallFunction(app.CallFunction("logiclab.get_TargetID") + ".GetAllPLCVariableUsages");
	}

	if (dataBlock)
	{
		// datablock specificato: estrae le globali e le divide tra non assegnate (automatiche) e già mappate (se non c'è il flag che forza l'utilizzo delle sole var auto)
		if (!(flags & PLCVARASSIGN_ONLYAUTO))
			allVars = [];
		
		var globalVars = app.CallFunction("logiclab.GetProjectVariables")
		for (var i = 0, t = globalVars.length; i < t; i++)
		{
			var v = globalVars.item(i)
			if (CheckPLCVarCompatibility(v))
			{
				// una variabile globale è assegnabile se è automatica e non const o retain (Attribute 0 = ATV_NONE)
				if (!v.IsDataBlock)
				{
					if (v.Attribute == PLCVAR_ATTR_NONE)
					{
						vars.push(v);
						if (allVars)
							allVars.push(v);
					}
				}
				else
				{
					if (allVars)
						allVars.push(v);
				}
			}
		}
	}
	else
	{
		// datablock NON specificato: estrae tutte le globali
		var globalVars = app.CallFunction("logiclab.GetProjectVariables");
		AddVarsToList(globalVars, false);
		
		if ( flags & PLCVARASSIGN_INCLUDE_TARGET_VARS )
		{
			// aggiunge tutte le target vars, già mappate
			var targetVars = app.CallFunction("logiclab.GetTargetVariables")
			AddVarsToList(targetVars, true);
		}
		
		if ( flags & PLCVARASSIGN_INCLUDE_LIBRARIES_VARS )
		{
			// aggiunge tutte le library vars, già mappate
			var librariesVars = app.CallFunction("logiclab.GetLibraryVariables", "*")
			AddVarsToList(librariesVars, true);
		}
		
		if ( flags & PLCVARASSIGN_INCLUDE_AUXSRC_VARS )
		{
			// aggiunge tutte le vars di aux src
			var auxsrcVars = app.CallFunction("logiclab.GetAuxSrcVariables", "")
			AddVarsToList(auxsrcVars, false);
		}
	}
		
	app.TempVar("VarsList_input") = vars
	app.TempVar("VarsList_allVars") = allVars
	app.TempVar("varsList_multipleSel") = false
	app.TempVar("varsList_allVarUsages") = allVarUsages
	
	app.OpenWindow("PLCVarsList", app.Translate("Choose PLC variable"), "")

	app.TempVar("VarsList_input") = undefined
	app.TempVar("VarsList_allVars") = undefined
	app.TempVar("varsList_multipleSel") = undefined
	app.TempVar("varsList_allVarUsages") = undefined
	
	var showAll = app.TempVar("VarsList_showAll")
	var result = app.TempVar("VarsList_result")
	if (!result || result.length == 0)
		return false
	
	// disassegna la variabile precedentemente assegnata se presente
	if (prevLabel)
		// verifica se possibile disassegnare la var precedente; testa usagecount > 1 perchè nel xml è ancora presente (sarà cambiata dal chiamante)
		if (app.CallFunction("script.CanUnassignPLCVar", prevLabel, 1))
			app.CallFunction("script.UnassignPLCVar", prevLabel)
	
	// result.length deve essere per forza 1 essendo multipleSel == false!
	if (showAll)
		var item = allVars[result[0]]
	else
		var item = vars[result[0]]
	
	if (dataBlock && !item.IsDataBlock)
		// se datablock specificato fa un assegnamento da auto a mappata
		if (!app.CallFunction("script.AssignPLCVar", item, dataBlock))
			return false
	
	return item
}

function UnAssignPLCVarFromGrid(row, grid, columns, doUnassign)
{
	var name = grid.Elem(row, columns.label)
	if (name != "")
	{
		// svuota la riga della griglia
		m_disableModifyPLCVarAssigment = true
		grid.Elem(row, columns.label) = ""
		m_disableModifyPLCVarAssigment = false
		
		if (columns.type != undefined)
			grid.Elem(row, columns.type) = ""
			
		if (columns.dataBlock != undefined)
			grid.Elem(row, columns.dataBlock) = ""
			
		if (columns.description != undefined)
			grid.Elem(row, columns.description) = ""
			
		if (columns.size != undefined)
			grid.Elem(row, columns.size) = 0;
			
		if (doUnassign)
			// disassegna la variabile, da mappata la riporta ad auto
			if (app.CallFunction("script.CanUnassignPLCVar", name, 0))
				app.CallFunction("script.UnassignPLCVar", name)
	}
}

function UnAssignPLCVars(grid, columns, group, doUnassign)
{
	if (doUnassign === undefined)
		doUnassign = true;   // default per retrocompatibilità
		
	if (grid.NumRows == 0)
		return false
	
	// se variabili globali già modificate e non salvate non permette l'operazione
	if (!app.CallFunction("script.CheckGlobalVarsModified", group))
		return false
	
	var list = app.CallFunction("common.GridGetSelections", grid)
	if (!list || list.length == 0)
		return false
	
	for (var i = 0; i < list.length; i++)
		UnAssignPLCVarFromGrid(list[i], grid, columns, doUnassign)
		
	return true
}

// modifica l'assegnamento della variabile PLC nella griglia specificata (chiamata da SetElemS ad es.)
// se variabile esistente e dataBlock specificato la assegna se auto, altrimenti ne permette la creazione
function ModifyPLCVarAssigment(grid, columns, name, type, allowedTypes, dataBlock, flags, globalVarsGroup, dataBlockRetain)
{
	if (m_disableModifyPLCVarAssigment)
		return false

	// se nessuna modifica esce
	var row = grid.SelectedRow
	var prevLabel = grid.Elem(row, columns.label)
	if (prevLabel == name)
		return false
		
	// se variabili globali già modificate e non salvate non permette l'operazione
	if (!app.CallFunction("script.CheckGlobalVarsModified", globalVarsGroup))
		return false
	
	// se nome non specificato (ovvero si è cancellato il contenuto) disassegna tutto e basta
	if (!name)
	{
		UnAssignPLCVarFromGrid(row, grid, columns, (dataBlock != ""))
		return false
	}
	
	var v = ModifyPLCVarAssigment_raw(name, type, allowedTypes, dataBlock, prevLabel, flags, globalVarsGroup, dataBlockRetain)
	if (!v)
		return false
		
	// setta i valori della riga
	if (columns.type != undefined)
		grid.Elem(row, columns.type) = v.type
		
	if (columns.dataBlock != undefined)
		grid.Elem(row, columns.dataBlock) = v.dataBlock
		
	if (columns.description != undefined)
		grid.Elem(row, columns.description) = v.description
	
	if (columns.size != undefined)
		grid.Elem(row, columns.size) = GetPLCVarSize(v);
	
	// ritorna il nome della variabile, sarà memorizzato con grid.Elem dal chiamante
	return v.name
}

/* direct assignment of PLC var by typing (e.g. in a textbox), with dialog for confirmation of name/type
 - name			: name of PLC to assign (eventually re-confirmed with dialog)
 - type			: type of PLC to assign (eventually re-confirmed with dialog)
 - allowedTypes	: options PLCVARTYPES_xxx
 - dataBlock	: if specified, db where to assign the variable
 - prevLabel	: previous variable, if specified it will unassigned
 - flags		: bitmask of PLCVARASSIGN_xxx
 - globalVarsGroup : name of global PLC var group to use. If not specified, will be "ungrouped vars"
 - dataBlockRetain : must be specified if PLCVARASSIGN_ALLOWRETAIN is set
*/
function ModifyPLCVarAssigment_raw(name, type, allowedTypes, dataBlock, prevLabel, flags, globalVarsGroup, dataBlockRetain)
{
	// se nessuna modifica esce
	if (prevLabel == name)
		return false
		
	// se variabili globali già modificate e non salvate non permette l'operazione
	if (!app.CallFunction("script.CheckGlobalVarsModified", globalVarsGroup))
		return false
	
	var isComplex = app.CallFunction("script.IsComplexVar", name)
	if (isComplex && (flags & PLCVARASSIGN_ONLYSIMPLE))
		// non permette input manuale di var complesse se specificato apposito flag
		return false
	
	// se nome non specificato (ovvero si è cancellato il contenuto) disassegna tutto e basta
	if (!name && dataBlock)
	{
		// verifica se possibile disassegnare la var precedente; testa usagecount > 1 perchè nel xml è ancora presente (sarà cambiata dal chiamante)
		if (app.CallFunction("script.CanUnassignPLCVar", prevLabel, 1))
			app.CallFunction("script.UnassignPLCVar", prevLabel)
			
		return false
	}
	
	// generazione lista di tipi IEC validi
	var typesList = []
	var arraySize
	
	if (flags & PLCVARASSIGN_SAMEARRAYSIZE)
	{
		// se tra i flag c'è PLCVARASSIGN_SAMEARRAYSIZE, il filtro del tipo può essere del tipo INT[10]
		var pos1 = type.indexOf("[");
		var pos2 = type.indexOf("]");
		if (pos1 != -1 && pos2 != -1)
		{
			arraySize = parseInt(type.slice(pos1+1, pos2));
			type = type.substr(0, pos1);
		}
	}

	if (allowedTypes === PLCVARTYPES_FIXED)
		// solo il tipo specificato
		typesList = [ type ]
	else if (allowedTypes === PLCVARTYPES_SAMESIZE)
	{
		// tutti i tipi della stessa dimensione in bit
		var bitSizes = app.CallFunction("common.GetAllIECTypeBits")
		var curSize = bitSizes[type]
		
		for (var t in bitSizes)
			if (bitSizes[t] == curSize)
				typesList.push(t)
	}
	else if (allowedTypes === PLCVARTYPES_ALL)
	{
		// tutti i tipi supportati
		var bitSizes = app.CallFunction("common.GetAllIECTypeBits")
		for (var t in bitSizes)
			typesList.push(t)
			
		typesList.push("STRING")  // aggiunge anche la stringa
		typesList.push("WSTRING") // aggiunge anche la stringa
	}
	else if (allowedTypes && typeof allowedTypes == "object")
		// la lista dei tipi specificata esplicitamente
		typesList = allowedTypes
	
	if (typesList.length == 0)
		return false   // nessun tipo valido??
	
	// cerca tra la variabili globali il nome iniziale specificato
	var v
	var baseName
	var baseVar
	
	if (!isComplex)
		// se non è complessa cerca tra le var di progetto, ha il vantaggio di non richiedere la symtab (e quindi la compilazione)
		v = app.CallFunction("logiclab.GetGlobalVariable", name)
	else
	{
		// se complessa cerca per forza nella symtab: bisogna aver prima compilato altrimenti la var non esiste
		baseName = app.CallFunction("script.GetComplexVarBaseName", name);
		v = app.CallFunction("logiclab.FindSymbol", name, "")
		if (v)
		{
			baseVar = app.CallFunction("logiclab.GetGlobalVariable", baseName);
			if (baseVar)
				// visto che v è una temporanea generata dalla FindSymbol (ma il cui campo DataBlock è letto poi dal chiamante) lo cambia e riallinea, senza side-effect
				// serve nel caso la var base sia stata appena mappata, ma non si è ancora ricompilato e quindi nella symtab è vecchia (auto)
				v.DataBlock = baseVar.DataBlock;
			else
				// se non si trova la var base c'è un errore (var cancellata dal prj ma non ancora ricompilato?)
				v = null;
		}
	}
	
	if (!v)
	{
		if (!isComplex && !(flags & PLCVARASSIGN_ONLYUNSPEC))
		{
			// se var non trovata mostra la dialog di creazione all'utente (se nome non complesso e non modo di sola assegnazione a unspec esistenti)
			var result
			if (!(flags & PLCVARASSIGN_HIDEDIALOG))
			{
				var params = { name: name, type: type, typesList: typesList, fixedArraySize: arraySize }
				app.TempVar("NewPLCVar_params") = params
				
				if (flags & PLCVARASSIGN_ALLOWRETAIN)
					app.TempVar("NewPLCVar_allowRetain") = true
				else
					app.TempVar("NewPLCVar_allowRetain") = false
			
				app.OpenWindow("NewPLCVar", app.Translate("New PLC variable"), "")
			
				result = app.TempVar("NewPLCVar_result")
				app.TempVar("NewPLCVar_result") = undefined
				
				//	se retain è necessario avere il datablock ritentivo su cui è pubblicata la variabile
				if (result && result.retain)
				{
					if (dataBlock && !dataBlockRetain)	//	datablock specificato ma non quello ritentivo
					{
						var msg = genfuncs.FormatMsg(app.Translate("Mapping variable on retain datablock is required but retain datablock is not specified"))
						app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
						return false
					}
					else if (!dataBlock)	//	nessun datablock specificato
					{
						var msg = genfuncs.FormatMsg(app.Translate("Automatic retain variable creation is not supported"))
						app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
						return false
					}
					
					//	modifico con il dataBlockRetain specificato il datablock su cui verrà creata la variabile
					dataBlock = dataBlockRetain					
				}
			}
			else
			{
				result = { name: name, type: type, retain: false };
				
				if (type == "STRING" || type == "WSTRING")
					result.size = 32; // dimensione di default di LL
				else if (arraySize)
					result.size = arraySize;
			}
			
			if (!result || !result.name || !result.type)
				return false
			
			name = result.name
			// cerca un'altra volta se la var esiste già
			v = app.CallFunction("logiclab.GetGlobalVariable", name)
			if (v)
			{
				var msg = genfuncs.FormatMsg(app.Translate("Variable %1 (type %2) already exists.\nTry to assign it instead of creating a new one?"), name, v.type)
				if (app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION | gentypes.MSGBOX.MB_OKCANCEL) == gentypes.MSGBOX.IDCANCEL)
					return false
			}
		}
		else
		{
			// se var complessa non trovata errore, deve essere creata (e usata nel codice, visto che è cercata nella symtab) a mano
			var msg = genfuncs.FormatMsg(app.Translate("Invalid PLC variable specified: %1\n\nIf you just created or modified the '%2' var, please build the project first,\nand make sure that the var is used inside the PLC code!"), name, baseName)
			app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
			return false
		}
	}
	
	if (v)
	{
		// se var già esistente verifica che sia di un tipo tra quelli validi
		if (genfuncs.ArrayIndexOf(typesList, v.type) == -1)
		{
			app.MessageBox(genfuncs.FormatMsg(app.Translate("Variable %1 (type %2) has an incompatible type"), name, v.type), "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
			return false
		}
		
		if (IsPLCArray(v))
		{
			if (!(flags & PLCVARASSIGN_ALLOWARRAYS))
			{
				app.MessageBox(app.Translate("Array variables not supported, please choose a scalar variable"), "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
				return false
			}
			
			var vsize = GetPLCVarSize(v);
			if ((flags & PLCVARASSIGN_SAMEARRAYSIZE) && vsize != arraySize)
			{
				app.MessageBox(genfuncs.FormatMsg(app.Translate("Variable %1 (size %2) has an incompatible array size"), name, vsize), "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
				return false;  // flag SAMEARRAYSIZE presente ma dimensioni errate
			}
		}

		if (!CheckUnspecifiedAddress(v.DataBlock, flags))
		{
			app.MessageBox(genfuncs.FormatMsg(app.Translate("Variable %1 has an incompatible address: %2"), name, v.DataBlock), "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
			return false;
		}
			
		if (dataBlock)
		{
			// datablock specificato: se variabile auto la assegna ora, se già su datablock errore
			if (!v.IsDataBlock)
			{
				if( v.Attribute == PLCVAR_ATTR_CONST ) //atvConst
				{
					app.MessageBox(genfuncs.FormatMsg(app.Translate("Error assigning constant %1 to datablock %2"), name, dataBlock), "", gentypes.MSGBOX.MB_ICONERROR)
					return false
				}
				
				if (!isComplex)
				{
					// variabile già esistente ed automatica e non complessa, la assegna
					if (!app.CallFunction("script.AssignPLCVar", v, dataBlock))
					{
						app.MessageBox(genfuncs.FormatMsg(app.Translate("Error assigning variable %1 to datablock %2"), name, dataBlock), "", gentypes.MSGBOX.MB_ICONERROR)
						return false
					}
				}
				else
				{
					// variabile già esistente ed automatica ma complessa, la assegna (la parte base)
					if (!app.CallFunction("script.AssignPLCVar", baseVar, dataBlock))
					{
						app.MessageBox(genfuncs.FormatMsg(app.Translate("Error assigning variable %1 to datablock %2"), baseName, dataBlock), "", gentypes.MSGBOX.MB_ICONERROR)
						return false
					}
					// visto che v è una temporanea generata dalla FindSymbol (ma il cui campo DataBlock è letto poi dal chiamante) lo cambia e riallinea, senza side-effect
					v.DataBlock = baseVar.DataBlock;
				}
			}
			else if (!isComplex)
			{
				// variabile scalare già esistente ma già su datablock
				if (flags & PLCVARASSIGN_ONLYAUTO)
				{
					// forza l'utilizzo delle sole var auto
					app.MessageBox(genfuncs.FormatMsg(app.Translate("Variable '%1' already exists but it is not automatic"), name), "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
					return false
				}
				else
				{
					// chiede conferma se riutilizzare una var scalare già su datablock
					var usage = GetVarUsages(app.CallFunction("logiclab.get_TargetID"), v)
					var msg = genfuncs.FormatMsg(app.Translate("Variable '%1' already exists but it is not automatic\n(already used on %2)\n\nAre you sure to assign it here anyway?"), name, usage)
					
					if (app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION|gentypes.MSGBOX.MB_OKCANCEL) == gentypes.MSGBOX.IDCANCEL)
						return false
				}
			}
		}
		
		// nel caso di var complesse (quindi cercate tramite symtab) se progetto case INSENSITIVE, la property name della CPlcVar tornata sarà UPPERCASE!
		// in questo caso quindi riassegna il nome, per farlo tornare come digitato: si può fare visto che la var tornata è una copia tmp
		if (isComplex && v.name != name)
			v.name = name
	}
	else
	{
		if (globalVarsGroup === undefined)
			globalVarsGroup = ""
		
		// da LogicLab >= 5.22.0.x la lunghezza delle stringhe va nel tipo e non più nella dimensione array, che ora serve veramente a dichiarare array!
		if ((result.type == "STRING" || result.type == "WSTRING") && result.size)
		{
			result.type += "[" + result.size + "]";
			result.size = undefined;
		}
		
		// aggiunta nuova variabile automatica al progetto
		v = app.CallFunction("logiclab.AddGlobalVariable", name, result.type, dataBlock, globalVarsGroup, result.size, null, result.retain ? PLCVAR_ATTR_RETAIN : PLCVAR_ATTR_NONE, "")
		if (!v)
		{
			app.MessageBox(genfuncs.FormatMsg(app.Translate("Error creating new automatic variable %1"), name), "", gentypes.MSGBOX.MB_ICONERROR)
			return false
		}
		
		// rinfresca la griglia delle global vars se aperta
		app.CallFunction("extfunct.ReloadGlobalVars", globalVarsGroup)
		// rinfresca l'albero delle var globali
		app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
	}
	
	
	// se nella griglia c'era già una variabile associata la disassegna
	var isUnassigned = false
	if (prevLabel && dataBlock)
		// verifica se possibile disassegnare la var precedente; testa usagecount > 1 perchè nel xml è ancora presente (sarà cambiata dal chiamante)
		if (app.CallFunction("script.CanUnassignPLCVar", prevLabel, 1))
			isUnassigned = app.CallFunction("script.UnassignPLCVar", prevLabel)
		
	// se variabile automatica chiede se cancellarla
	if ((flags & PLCVARASSIGN_ASKDELETEAUTO) && prevLabel && (!dataBlock || isUnassigned))
	{
		var msg = genfuncs.FormatMsg(app.Translate("Do you want to delete the PREVIOUS assigned '%1' PLC variable?"), prevLabel)
		if (app.MessageBox(msg, "", gentypes.MSGBOX.MB_YESNO|gentypes.MSGBOX.MB_ICONQUESTION) == gentypes.MSGBOX.IDYES)
		{
			if (app.CallFunction("logiclab.DeleteGlobalObject", prevLabel))
			{	
			
				// rinfresca la griglia delle global vars se aperta
				app.CallFunction("extfunct.ReloadGlobalVars", globalVarsGroup)
				// rinfresca l'albero delle var globali
				app.CallFunction("extfunct.UpdateWorkspaceGlobalVariables")
			}
		}
	}
	
	// ritorna la variabile PLC
	return v
}

function GetVarUsages(extName, v)
{
	if (!v.IsDataBlock)
		return "auto"
		
	var parsedDB = app.CallFunction("common.ParseDataBlock", v.DataBlock)
	if (!parsedDB)
		return "?"
	if (!app.CallFunction(extName + ".IsResourceManagedDatablock", parsedDB.area, parsedDB.datablock))
		return "other datablock"
		
	// chiama funzione specifica di GetPLCVariableUsages del target corrente
	var usages = app.CallFunction(extName + ".GetPLCVariableUsages", v.Name)
	// se la variabile specificata è usata in più di un contesto non la disassegna ora, sarà fatto all'ultima cancellazione
	if (!usages || usages.length == 0)
		return "?"
	
	var result = []
	for (var i = 0; i < usages.length; i++)
		result.push( usages[i].descr )
		
	return result.join(", ")
}

function GetProjectRetainVariables(basicTypeOnly)
{
	var logicLabTypes = app.CallFunction("script.GetLogicLabTypes")
	var typeTargs = logicLabTypes.TYPETARG
	
	var retainVars = []
	
	var globalVars = app.CallFunction("logiclab.GetProjectVariables")
	for (var i = 0, t = globalVars.length; i < t; i++)
	{
		var v = globalVars.item(i)
		
		if (v.Attribute != PLCVAR_ATTR_RETAIN)
			continue

		if(basicTypeOnly)
		{
			if (!typeTargs[v.type])
				continue
		}
			
		retainVars.push( v )
	}
	
	return retainVars;
}