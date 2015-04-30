//Author-Autodesk Inc.
//Description-Apply a material to selected bodies.
/*globals adsk*/
(function () {

    "use strict";
    var commandId = 'ApplyMaterialToSelectionCommand';
    var commandName = 'ApplyMaterialToSelection';
    var commandDescription = 'Apply a material to selected bodies';
    
    var app = adsk.core.Application.get(), ui;
    var materialsMap = {};
    
    if (app) {
        ui = app.userInterface;
    }
    
    var errorDescription = function(e) {
        return (e.description ? e.description : e);
    };
    
    var getMaterial = function(materialName) {
        var materialLibs = app.materialLibraries;
        var material;
        for (var x = 0; x < materialLibs.count; ++x) {
            var materialLib = materialLibs.item(x);
            var materials = materialLib.materials;
            try {
                material = materials.itemByName(materialName);
            } catch (e) {
                console.log(errorDescription(e));
            }
            if (material) {
                break;
            }
        }
            
        return material;
    };
    
    var getSelectedBodies = function(selectionInput) {
        var bodies = [];
        for (var x = 0; x < selectionInput.selectionCount; ++x) {
            var selection = selectionInput.selection(x);
            var selectedObj = selection.entity;
            if ('adsk::fusion::BRepBody' == selectedObj.objectType) {
                bodies.push(selectedObj);
            } else if ('adsk::fusion::Occurrence' == selectedObj.objectType) {
                var component = selectedObj.component;
                var componentBodies = component.bRepBodies;
                for (var n = 0; n < componentBodies.count; ++n) {
                    bodies.push(componentBodies.item(n));
                }
            }
        }
        
        return bodies;
    };
    
    var applyMaterialToBodies = function(material, bodies) {
        for (var x = 0; x < bodies.length; ++x) {
            var body = bodies[x];
            body.material = material;
        }
    };
    
    var clearAllItems = function(cmdInput) {
        cmdInput.listItems.add('None', true);
        while(cmdInput.listItems.count > 1) {
            if (cmdInput.listItems.item(0).name != 'None') {
                cmdInput.listItems.item(0).deleteMe();
            } else {
                cmdInput.listItems.item(1).deleteMe();
            }
        }
    };
    
    var replaceItems = function(cmdInput, newItems) {
        clearAllItems(cmdInput);
        if (newItems.length > 0) {
            for (var x = 0; x < newItems.length; ++x) {
                cmdInput.listItems.add(newItems[x], false);
            }
            cmdInput.listItems.item(1).isSelected = true;
            cmdInput.listItems.item(0).deleteMe();
        }
    };
    
    var getMaterialLibNames = function() {
        var materialLibs = app.materialLibraries;
        var libNames = [];
        for (var x = 0; x < materialLibs.count; ++x) {
            if (materialLibs.item(x).materials.count > 0) {
                libNames.push(materialLibs.item(x).name);
            }
        }
        return libNames;
    };
    
    var getMaterialsFromLib = function(libName, filterExp) {
        var materialList;
        if (materialsMap[libName]) {
            materialList = materialsMap[libName];
        } else {
            var materialLib = app.materialLibraries.itemByName(libName);
            var materials = materialLib.materials;
            var materialNames = [];
            for (var x = 0; x < materials.count; ++x) {
                materialNames.push(materials.item(x).name);
            }
            materialsMap[libName] = materialNames;
            materialList = materialNames;
        }
        
        if (filterExp && filterExp.length > 0) {
            var filteredList = [];
            for (var i = 0; i < materialList.length; ++i) {
                var materialName = materialList[i];
                if (materialName.toLowerCase().indexOf(filterExp.toLowerCase()) >= 0) {
                    filteredList.push(materialName);
                }
            }
            
            return filteredList;
        } else {
            return materialList;
        }
    };
    
    var createCommandDefinition = function() {
        var commandDefinitions = ui.commandDefinitions;
        
        // Check if the command is already added
        var cmDef = commandDefinitions.itemById(commandId);
        if (!cmDef) {
            cmDef = commandDefinitions.addButtonDefinition(commandId, 
                    commandName, 
                    commandDescription); // no resource folder is specified, the default one will be used
        }
        return cmDef;
    };
    
    var onInputChanged = function(args) {
        try {
            var command = adsk.core.Command(args.firingEvent.sender);
            var inputs = command.commandInputs;
            var materialListInput, filterInput, materialLibInput;
            for (var x = 0; x < inputs.count; ++x) {
                var input = inputs.item(x);
                 if (input.id == commandId + '_materialList') {
                      materialListInput = input;
                 } else if (input.id == commandId + '_materialLib') {
                    materialLibInput = input;
                 } else if (input.id == commandId + '_filter') {
                     filterInput = input;
                 }
             }
            var changedInput = args.input;
            if (changedInput.id == commandId + '_materialLib' ||
               changedInput.id == commandId + '_filter') {
                var materials = getMaterialsFromLib(materialLibInput.selectedItem.name, filterInput.value);
                replaceItems(materialListInput, materials);
            }
        } catch(e) {
            ui.messageBox('input change failed: ' + errorDescription(e));
        }
    };
    
    var onCommandExecuted = function(args) {
        try {
            var command = adsk.core.Command(args.firingEvent.sender);
            var inputs = command.commandInputs;
            var materialListInput, selectionInput;
            for (var x = 0; x < inputs.count; ++x) {
                var input = inputs.item(x);
                if (input.id == commandId + '_selection') {
                    selectionInput = input;
                } else if (input.id == commandId + '_materialList') {
                    materialListInput = input;
                }
            }
            
            var boides = getSelectedBodies(selectionInput);
            if  (!boides || boides.length === 0) {
                return;
            }
            
            var material = getMaterial(materialListInput.selectedItem.name);
            if (!material) {
                return;
            }
            
            applyMaterialToBodies(material, boides);
        } catch (e) {
            ui.messageBox('command executed failed: ' + errorDescription(e));
        }
    };
    
    var onCommandCreated = function(args) {
        try {
            var command = args.command;
            command.execute.add(onCommandExecuted);
            command.inputChanged.add(onInputChanged);

            // Terminate the script when the command is destroyed
            command.destroy.add(function () { adsk.terminate(); });

            var inputs = command.commandInputs;
            var selectionInput = inputs.addSelectionInput(commandId + '_selection', 'Select', 'Select bodies or occurrences');
            selectionInput.setSelectionLimits(1);
            selectionInput.selectionFilters = ['SolidBodies', 'Occurrences'];
            var materialLibInput = inputs.addDropDownCommandInput(commandId + '_materialLib', 'Material Library', adsk.core.DropDownStyles.LabeledIconDropDownStyle);
            var listItems = materialLibInput.listItems;
            var materialLibNames = getMaterialLibNames();
            for (var x = 0; x < materialLibNames.length; ++x) {
                listItems.add(materialLibNames[x], false);
            }
            listItems.item(1).isSelected = true;
            
            var materialListInput = inputs.addDropDownCommandInput(commandId + '_materialList', 'Material', adsk.core.DropDownStyles.TextListDropDownStyle);
            var materials = getMaterialsFromLib(materialLibNames[1], '');
            listItems = materialListInput.listItems;
            for (var i = 0; i < materials.length; ++i) {
                listItems.add(materials[i], false);
            }
            listItems.item(0).isSelected = true;
            inputs.addStringValueInput(commandId + '_filter', 'Filter');
            
        } catch (e) {
            ui.messageBox('command created failed: ' + errorDescription(e));
        }
    };
    
    try {
        if (adsk.debug === true) {
            /*jslint debug: true*/
            debugger;
            /*jslint debug: false*/
        }

        var command = createCommandDefinition();
        var commandCreatedEvent = command.commandCreated;
        commandCreatedEvent.add(onCommandCreated);
        command.execute();
    } catch (e) {
        ui.messageBox('Failed: ' + errorDescription(e));
        adsk.terminate();
    }
}());
