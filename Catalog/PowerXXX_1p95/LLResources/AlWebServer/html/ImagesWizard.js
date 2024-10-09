var app = window.external;
var m_fso = app.CallFunction( "common.CreateObject", "Scripting.FileSystemObject" )

const WEBSITE_FOLDER_NAME = "website";
const WEBIMG_FOLDER_NAME = "img";

window.addEventListener('DOMContentLoaded', InitPage);

function InitPage()
{
    // nome enumerativo
    let enumName = app.TempVar("ImagesWizard_enum");
    app.TempVar("ImagesWizard_enum") = undefined;

    // campo contenente la lista delle immagini
    let imgList = app.TempVar("ImagesWizard_enum_images");
    app.TempVar("ImagesWizard_enum_images") = undefined;

    let enumValues = app.CallFunction("WebServer.GetEnumValues", enumName);
    if (enumValues)
    {
        let imgMap = {};
        if (imgList)
            imgMap = ParseEnumImagesString(imgList);

        BuildEnumTable(enumValues, imgMap);
    }

    app.TempVar("ImagesWizard_enum_result") = null;
}


/**
 * Parsa la stringa di un enumerativo esistente
 */
function ParseEnumImagesString(imgList)
{
    var result = {};

    function AddEnumImg(value, img)
    {
        result[value] = img
    }

    // tolgo dalla stringa tutti gli spazi bianchi
    let imgFilenames = imgList.replace(/ /g, "");

    let imgFileNamesArr = imgFilenames.split(",");

    for (var i = 0, j = imgFileNamesArr.length; i < j; i++)
    {
        let imgValueItem = imgFileNamesArr[i];

        if (!imgValueItem.match(/^(\d+|true|false):\w+\.\w+$/))
        {
            app.MessageBox(genfuncs.FormatMsg(app.Translate("Wrong syntax for '%1': it must be 'Value:ImageName.extension'"), imgValueItem), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
            continue;
        }

        let imgValueArr = imgValueItem.split(":");

        let value = imgValueArr[0];
        let imgFile = imgValueArr[1];

        AddEnumImg(value, imgFile);
    }

    return result;
}

/**
 * Costruisce la tabella degli enum
 * @param {*} enumValues 
 */
function BuildEnumTable(enumValues, imgMap)
{
	for (var value in enumValues)
    {
        let name = enumValues[value];
        let imgFile = imgMap[value] ? imgMap[value] : "";
        enumsContainer.appendChild(BuildEnumRow(value, name, imgFile));
    }
}

/**
 * Costriusce la singola riga della tabella
 * @param {*} enumVal 
 * @param {*} enumDescr 
 * @param {*} imgFile
 */
function BuildEnumRow(enumVal, enumDescr, imgFile)
{
    let row = document.createElement("tr");
    row.classList.add("mt-xs");

    let enumValue = document.createElement("td");
    enumValue.innerText = enumVal;
    row.appendChild(enumValue);
    
    let enumName = document.createElement("td");
    enumName.innerText = enumDescr;
    row.appendChild(enumName);

    let imgSelectionSpan = document.createElement("td");
    let inputImg = document.createElement("input");
    inputImg.classList.add("img-input");
    // l'attributo serve per effettuare l'associazione Valore:FileImmagine.xyz
    inputImg.setAttribute("data-img-value", enumVal);
    inputImg.value = imgFile;
    imgSelectionSpan.appendChild(inputImg);

    let btnSelectImg = document.createElement("button");
    btnSelectImg.innerText = "...";
    btnSelectImg.onclick = function () {
        ChooseImage(inputImg);
    }
    imgSelectionSpan.appendChild(btnSelectImg);

    row.appendChild(imgSelectionSpan);

    return row;
}

/**
 * Apre la dialog per scegliere l'immagine e la copia nella cartella del progetto
 * @param {*} inputImg 
 */
function ChooseImage(inputImg)
{
    function DoCopyFile(src, dest)
    {
        try
        {
            m_fso.CopyFile(src, dest, true)
            app.PrintMessage("Image file copied from " + src + " to project directory");
            return true
        }
        catch (ex)
        {
            app.PrintMessage("ERROR copying " + src + " to " + dest);
			alert("ERROR copying file");
            return false
        }
    }

    var filename = app.CallFunction("commonDLL.ShowOpenFileDlg", "Image file (*.*)|*.*||s", "")
    if (!filename)
        return

    // creazione cartelle PROGETTO\website\img se non esistenti
	var destPath = m_fso.GetParentFolderName(app.CallFunction("logiclab.get_ProjectPath")) + "\\" + WEBSITE_FOLDER_NAME;
	if (!m_fso.FolderExists(destPath))
		m_fso.CreateFolder(destPath);
	
	destPath += "\\" + WEBIMG_FOLDER_NAME;
	if (!m_fso.FolderExists(destPath))
		m_fso.CreateFolder(destPath);

    let res = DoCopyFile(filename, destPath + "\\" + m_fso.GetFileName(filename));

    // setta nome file relativo alla cartella del progetto
    if (res)
        inputImg.value = m_fso.GetFileName(filename);
}

function OnOK()
{
    let result = GetImgString();
    if (result)
    {
        app.TempVar("ImagesWizard_enum_result") = result;
        CloseDlg();
    }
}

/**
 * Crea la stringa risultante dalle righe della tabella
 */
function GetImgString()
{
    let resultStr = "";

    let inputsList = document.querySelectorAll("[data-img-value]");
    for (let i = 0, j = inputsList.length; i < j; i++)
    {
        let input = inputsList[i];

        if (!input.value)
            continue;

        if (resultStr)
            resultStr += ", ";

        // il valore dell'enumerativo e' nell'attributo, mentre il nome dell'immagine e' il valore stesso della input
        let imgValue = input.getAttribute("data-img-value");
        resultStr += imgValue + ":" + input.value;
    }

    return resultStr;
}