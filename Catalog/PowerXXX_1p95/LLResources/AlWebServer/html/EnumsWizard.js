var app = window.external;

window.addEventListener('DOMContentLoaded', InitPage);

var m_enumMap = {};

function InitPage()
{
    // nome enumerativo
    let enumName = app.TempVar("EnumsWizard_enum");
    app.TempVar("EnumsWizard_enum") = undefined;

    // campo contenente l'esmpressione
    let expr = app.TempVar("EnumsWizard_enum_expr");
    app.TempVar("EnumsWizard_enum_expr") = undefined;

    let enumValues = app.CallFunction("WebServer.GetEnumValues", enumName);
    if (enumValues)
    {
        m_enumMap = {};
        if (expr)
            m_enumMap = ParseEnumString(expr);

        BuildEnumTable(enumValues, m_enumMap);
    }

    app.TempVar("EnumsWizard_enum_result") = null;
}


/**
 * Parsa la stringa di un enumerativo esistente
 */
function ParseEnumString(exprStr)
{
    var result = {};

    function AddEnumExpr(value, descr, enabled)
    {
        result[value] = {descr: descr, enabled: enabled };
    }

    // tolgo dalla stringa tutti gli spazi bianchi
    exprStr = exprStr.replace(/ /g, "");

    let exprList = exprStr.split(",");

    for (var i = 0, j = exprList.length; i < j; i++)
    {
        let expr = exprList[i];

        // espressione tipo 1:pippo o true:pippo
        if (expr.match(/^(\d+|true|false):\w+$/))
        {
            let exprValueDescr = expr.split(":");

            let value = exprValueDescr[0];
            let descr = exprValueDescr[1];

            AddEnumExpr(value, descr, true);
        }
        // espressione tipo 1, true
        else if (expr.match(/^(\d+|true|false)$/))
        {
            AddEnumExpr(expr, null, true);
        }
        else {
            app.MessageBox(genfuncs.FormatMsg(app.Translate("Wrong syntax for '%1': it must be 'Value:description' or value alone"), expr), "", gentypes.MSGBOX.MB_ICONEXCLAMATION);
            continue;
        }
    }

    return result;
}

/**
 * Costruisce la tabella degli enum
 * @param {*} enumValues 
 */
function BuildEnumTable(enumValues, enumMap)
{
	for (var value in enumValues)
    {
        let desc = "";
        let enabled = false;

        let name = enumValues[value];
        if (enumMap[value]) {
            desc = enumMap[value].descr ? enumMap[value].descr : "";
            enabled = enumMap[value].enabled;
        }

        enumsContainer.appendChild(BuildEnumRow(value, name, desc, enabled));
    }
}

/**
 * Costriusce la singola riga della tabella
 * @param {*} val 
 * @param {*} descr 
 */
function BuildEnumRow(val, name, descr, enabled)
{
    let row = document.createElement("tr");
    row.classList.add("mt-xs");

    let valueTd = document.createElement("td");
    valueTd.innerText = val;
    row.appendChild(valueTd);
    
    let nameTd = document.createElement("td");
    nameTd.innerText = name;
    row.appendChild(nameTd);

    let enableTd = document.createElement("td");
    let inputChk = document.createElement("input");
    inputChk.type = "checkbox";
    // l'attributo serve in fase di generazione
    inputChk.setAttribute("data-en-value", val);
    inputChk.checked = enabled;
    enableTd.appendChild(inputChk);
    row.appendChild(enableTd);

    let descrTd = document.createElement("td");
    let inputDescr = document.createElement("input");
    inputDescr.classList.add("input");
    inputDescr.type = "text";
    // l'attributo serve in fase di generazione
    inputDescr.setAttribute("data-en-value", val);
    inputDescr.value = descr;
    inputDescr.addEventListener("keyup", function() { OnDescKeyUp(this) });
    descrTd.appendChild(inputDescr);
    row.appendChild(descrTd);

    return row;
}

function OnDescKeyUp(input)
{
    if (input.value)
    {
        let inputAttr = input.getAttribute('data-en-value');
        let inputChk = document.querySelector("input[type='checkbox'][data-en-value='"+inputAttr+"']")
        inputChk.checked = true;
    }
}

function OnOK()
{
    let result = GetExprString();
    if (result)
    {
        app.TempVar("EnumsWizard_enum_result") = result;
        CloseDlg();
    }
}

/**
 * Crea la stringa risultante dalle righe della tabella
 */
function GetExprString()
{
    let resultStr = "";

    let inputsList = document.querySelectorAll("input[type='checkbox'][data-en-value]")
    for (let i = 0, j = inputsList.length; i < j; i++)
    {
        let input = inputsList[i];

        // se non e' abilitato continuo
        if (!input.checked)
            continue;

        let inputAttr = input.getAttribute('data-en-value');
        let inputDescr = document.querySelector("input[type='text'][data-en-value='"+inputAttr+"']").value;

        if (resultStr)
            resultStr += ", ";

        // il valore dell'enumerativo e' nell'attributo, mentre la descrizione e' contenuta nella input testuale
        let enumValue = input.getAttribute("data-en-value");
        if (inputDescr)
            resultStr += enumValue + ":" + inputDescr;
        else
            resultStr += enumValue;
    }

    return resultStr;
}