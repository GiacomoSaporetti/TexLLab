var app = window.external;

var shell = app.CallFunction("common.CreateObject", "WScript.Shell");
var m_fso = genfuncs.CreateObject("Scripting.FileSystemObject");
var gentypes = app.CallFunction("common.GetGeneralTypes");

// directory in cui scrivere i file con source code differente
const TEMP_PATH = shell.ExpandEnvironmentStrings("%TEMP%") + "\\LL_PrjCompare";


// valori di default se l'editor non e' stato configurato
const DEFAULT_DIFF_TOOL_NAME = "\\WinMerge\\WinMergeU.exe";
const DEFAULT_DIFF_TOOL_PARAMETERS = "/e /t Text /s /u /wl /wr";
// %ProgramW6432% serve per i software che girano su WOW64. se il software fosse x64 si potrebbe mettere direttamente %ProgramFiles%
const PROGRAMS_FOLDER = shell.ExpandEnvironmentStrings("%ProgramW6432%");
const PROGRAMS_X86_FOLDER = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%");
const LOCAL_APPDATA_FOLDER = shell.ExpandEnvironmentStrings("%LocalAppData%");


// definiti uguali in ExtDiffToolConfig.html
const INI_SECTION_PREFIX = "Settings";
const INI_SETTING_TOOL_NAME = "PrjCompare_Diff_Tool_Name";
const INI_SETTING_TOOL_PARAMETERS = "PrjCompare_Diff_Tool_Parameters";


var m_diffToolName = null;
var m_diffToolParams = "";

function InitPage() {
	let diffStr = app.TempVar("ProjectsCompare_fieldDiffs")
	app.TempVar("ProjectsCompare_fieldDiffs") = undefined;

	let diffObj = JSON.parse(diffStr);

	for (let key in diffObj) {
		let diff = diffObj[key];
		
		var itemRow = diffTbl.insertRow(-1);
		var itemColName = itemRow.insertCell(0);
		var itemColLeft = itemRow.insertCell(1);
		var itemColRight = itemRow.insertCell(2);

		itemColName.innerText = showFieldName(diff);

		// il name e' il nome del field
		if (diff.name != "sourceCode") {
			itemColLeft.innerHTML = createElementList(diff.left);
			itemColRight.innerHTML = createElementList(diff.right);
		}
		else {
			let span = document.createElement("span");
			span.innerText += " ";
			itemColName.appendChild(span);
			itemColName.appendChild(createOpenSrcCodeButton(diff.left, diff.right));

			itemColLeft.innerHTML = "N/A";
			itemColRight.innerHTML = "N/A";
		}
	}

	let useDefaultParams = false;
	let INIEditorName = app.ReadINIString(INI_SECTION_PREFIX, INI_SETTING_TOOL_NAME);
	if (INIEditorName)
		m_diffToolName = INIEditorName;
	else {
		// tre tentativi perche' non possiamo sapere cosa sia stato installato dall'utente:
		// cerca in "Program Files", "Program Files (x86)" e "Users\*\AppData\Local"
		if (m_fso.FileExists(PROGRAMS_FOLDER + DEFAULT_DIFF_TOOL_NAME))
			m_diffToolName = PROGRAMS_FOLDER + DEFAULT_DIFF_TOOL_NAME;
		else if (m_fso.FileExists(PROGRAMS_X86_FOLDER + DEFAULT_DIFF_TOOL_NAME))
			m_diffToolName = PROGRAMS_X86_FOLDER + DEFAULT_DIFF_TOOL_NAME;
		else if (m_fso.FileExists(LOCAL_APPDATA_FOLDER + "\\Programs" + DEFAULT_DIFF_TOOL_NAME))
			m_diffToolName = LOCAL_APPDATA_FOLDER + "\\Programs" + DEFAULT_DIFF_TOOL_NAME;

		// li uso solo se sto usando il tool di default, altrimenti non ha senso
		if (m_diffToolName)
			useDefaultParams = true;
	}

	let INIEditorParams = app.ReadINIString(INI_SECTION_PREFIX, INI_SETTING_TOOL_PARAMETERS);
	if (INIEditorParams)
		m_diffToolParams = INIEditorParams;
	else if (useDefaultParams)
		m_diffToolParams = DEFAULT_DIFF_TOOL_PARAMETERS;
}

function showFieldName(diff) {
	if (FIELD_NAMES[diff.type] !== undefined && FIELD_NAMES[diff.type][diff.name])
		return FIELD_NAMES[diff.type][diff.name];

	return diff.name;
}

function createElementList(str) {
	if (!str)
		return '<span class="txt">---</span>';

	// Creazione dell'array
	let array = str.split(',');

	// cancella l'ultimo elemento se vuoto
	if (array[array.length - 1] == "")
		array.splice((array.length - 1), 1);

	if (array.length == 1)
		return '<span class="txt">' + array[0] + '</span>';

	// Creazione della lista HTML
	let listHTML = '<ul>';

	// Iterazione sull'array e creazione degli elementi della lista
	array.forEach(function (item) {
		listHTML += '<li>' + item.trim() + '</li>';
	});

	// Chiusura della lista HTML
	listHTML += '</ul>';

	return listHTML;
}

function createOpenSrcCodeButton(src1, src2) {
	var button = document.createElement('button');
	button.className = "ll-button";
	button.onclick = function() {
		openDiffEditor(src1, src2);
	}
	button.title = app.Translate("Show source code differences in the external tool (read-only)")
	let img = document.createElement("img");
	img.src = m_darkTheme ? "icons\\openSrcCode_dark.png" : "icons\\openSrcCode.png";
	button.appendChild(img);
	return button;
}

function openDiffEditor(f1Txt, f2Txt) {
	if (!m_diffToolName) {
		app.MessageBox(app.Translate("External diff. tool not configured.\nInstall WinMerge or select one from 'Settings' in the main page."), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
		return;
	}

	let f1Name = Math.random().toString(36).substring(2, 6) + ".txt";
	let f2Name = Math.random().toString(36).substring(2, 6) + ".txt";

	if (!m_fso.FolderExists(TEMP_PATH))
		m_fso.CreateFolder(TEMP_PATH);

	let f1Path = TEMP_PATH + "\\" + f1Name;
	let f2Path = TEMP_PATH + "\\" + f2Name;

	let f1 = app.CallFunction("common.SafeCreateTextFile", f1Path);
	let f2 = app.CallFunction("common.SafeCreateTextFile", f2Path);

	f1.WriteLine(f1Txt);
	f2.WriteLine(f2Txt);

	f1.Close();
	f2.Close();

	try {
		shell.Run(genfuncs.FormatMsg("\"%1\" %2 %3 %4", m_diffToolName, m_diffToolParams, f1Path, f2Path));
	} catch (error) {
		app.MessageBox(app.Translate("Cannot open the external diff. tool\nPlese check your configuration"), "", gentypes.MSGBOX.MB_ICONERROR);
	}
}

// pulizia dei file temporanei alla chiusura della finestra
window.addEventListener("unload", function(event) {
	if (m_fso.FolderExists(TEMP_PATH))
		m_fso.DeleteFolder(TEMP_PATH);
});