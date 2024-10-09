function OnOK()
{
    var findInName = chkFindInName.checked;
    var findInType = chkFindInType.checked;
    var findInAddress = chkFindInAddress.checked;
    var findInGroup = chkFindInGroup.checked;
    var findInAttribute = chkFindInAttribute.checked;
    var findInDesc = chkFindInDesc.checked;

    if (!findInName && !findInType && !findInAddress && !findInGroup && !findInAttribute && !findInDesc) {
        alert(app.Translate("Select at least a search field"));
        return;
    }

    var searchText =  txtName.value;

    if (!searchText) {
        alert(app.Translate("Insert a text to search"));
        return;
    }

    var criteria = {
        searchText: txtName.value,
        caseSensitive: chkCaseSensitive.checked,
        wholeWord: chkWholeWord.checked,
        findInName: findInName,
        findInType: findInType,
        findInAddress: findInAddress,
        findInGroup: findInGroup,
        findInAttribute: findInAttribute,
        findInDesc: findInDesc
    };

    // criteri di filtro NUOVI. se usciamo con cancel, non verranno impostati
    app.TempVar("FindParameters_result") = criteria;
    CloseDlg();
}

//ripristina i criteri precedentemente usati
function RestoreCriteria() {
    // criteri di filtro PRECEDENTI
    var criteria = app.TempVar("FindParameters_criteria");

    if (criteria) {

        var searchText = criteria.searchText;
        if(searchText) {
            txtName.value = searchText;
            setCaretPosition(txtName, searchText.length);
        }

        chkCaseSensitive.checked = criteria.caseSensitive;
        chkWholeWord.checked = criteria.wholeWord;
        chkFindInName.checked = criteria.findInName;
        chkFindInType.checked = criteria.findInType;
        chkFindInAddress.checked = criteria.findInAddress;
        chkFindInGroup.checked = criteria.findInGroup;
        chkFindInAttribute.checked = criteria.findInAttribute;
        chkFindInDesc.checked = criteria.findInDesc;
    }
}

function OnKeyDown() {
    if (event.keyCode == 13) {
        OnOK();
    }
}

function InitPage() {
    RestoreCriteria();
}

/**
 * Sposta il cursore dell'input
 * @param {object} elem id dell'input
 * @param {number} caretPos posizione in cui spostare il cursore
 */
function setCaretPosition(elem, caretPos) {

    if(elem != null) {
        if(elem.createTextRange) {
            var range = elem.createTextRange();
            range.move('character', caretPos);
            range.select();
        }
        else {
            if(elem.selectionStart) {
                elem.focus();
                elem.setSelectionRange(caretPos, caretPos);
            }
            else
                elem.focus();
        }
    }
}