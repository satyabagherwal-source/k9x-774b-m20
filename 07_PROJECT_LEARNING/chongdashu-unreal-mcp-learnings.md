> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chongdashu-unreal-mcp-learnings.md`  
> **Source**: github ([https://github.com/chongdashu/unreal-mcp](https://github.com/chongdashu/unreal-mcp))  
> **Source Version**: `4e5f00da`  
> **License**: PERMISSIVE_OPEN_SOURCE  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T17:16:49.070Z  
> **Learning ID**: `learn-github-chongdashu-unreal-mcp`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): chongdashu/unreal-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/chongdashu-unreal-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chongdashu/unreal-mcp](https://github.com/chongdashu/unreal-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T17:16:48.292Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chongdashu/unreal-mcp`
- **Description**: Enable AI assistant clients like Cursor, Windsurf and Claude Desktop to control Unreal Engine through natural language using the Model Context Protocol (MCP).
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2107 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPCommonUtils.cpp`
```
#include "Commands/UnrealMCPCommonUtils.h"
#include "GameFramework/Actor.h"
#include "Engine/Blueprint.h"
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphNode.h"
#include "EdGraph/EdGraphPin.h"
#include "K2Node_Event.h"
#include "K2Node_CallFunction.h"
#include "K2Node_VariableGet.h"
#include "K2Node_VariableSet.h"
#include "K2Node_InputAction.h"
#include "K2Node_Self.h"
#include "EdGraphSchema_K2.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Components/StaticMeshComponent.h"
#include "Components/LightComponent.h"
#include "Components/PrimitiveComponent.h"
#include "Components/SceneComponent.h"
#include "UObject/UObjectIterator.h"
#include "Engine/Selection.h"
#include "EditorAssetLibrary.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "BlueprintNodeSpawner.h"
#include "BlueprintActionDatabase.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"

// JSON Utilities
TSharedPtr<FJsonObject> FUnrealMCPCommonUtils::CreateErrorResponse(const FString& Message)
{
    TSharedPtr<FJsonObject> ResponseObject = MakeShared<FJsonObject>();
    ResponseObject->SetBoolField(TEXT("success"), false);
    ResponseObject->SetStringField(TEXT("error"), Message);
    return ResponseObject;
}

TSharedPtr<FJsonObject> FUnrealMCPCommonUtils::CreateSuccessResponse(const TSharedPtr<FJsonObject>& Data)
{
    TSharedPtr<FJsonObject> ResponseObject = MakeShared<FJsonObject>();
    ResponseObject->SetBoolField(TEXT("success"), true);
    
    if (Data.IsValid())
    {
        ResponseObject->SetObjectField(TEXT("data"), Data);
    }
    
    return ResponseObject;
}

void FUnrealMCPCommonUtils::GetIntArrayFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName, TArray<int32>& OutArray)
{
    OutArray.Reset();
    
    if (!JsonObject->HasField(FieldName))
    {
        return;
    }
    
    const TArray<TSharedPtr<FJsonValue>>* JsonArray;
    if (JsonObject->TryGetArrayField(FieldName, JsonArray))
    {
        for (const TSharedPtr<FJsonValue>& Value : *JsonArray)
        {
            OutArray.Add((int32)Value->AsNumber());
        }
    }
}

void FUnrealMCPCommonUtils::GetFloatArrayFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName, TArray<float>& OutArray)
{
    OutArray.Reset();
    
    if (!JsonObject->HasField(FieldName))
    {
        return;
    }
    
    const TArray<TSharedPtr<FJsonValue>>* JsonArray;
    if (JsonObject->TryGetArrayField(FieldName, JsonArray))
    {
        for (const TSharedPtr<FJsonValue>& Value : *JsonArray)
        {
            OutArray.Add((float)Value->AsNumber());
        }
    }
}

FVector2D FUnrealMCPCommonUtils::GetVector2DFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName)
{
    FVector2D Result(0.0f, 0.0f);
    
    if (!JsonObject->HasField(FieldName))
    {
        return Result;
    }
    
    const TArray<TSharedPtr<FJsonValue>>* JsonArray;
    if (JsonObject->TryGetArrayField(FieldName, JsonArray) && JsonArray->Num() >= 2)
    {
        Result.X = (float)(*JsonArray)[0]->AsNumber();
        Result.Y = (float)(*JsonArray)[1]->AsNumber();
    }
    
    return Result;
}

FVector FUnrealMCPCommonUtils::GetVectorFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName)
{
    FVector Result(0.0f, 0.0f, 0.0f);
    
    if (!JsonObject->HasField(FieldName))
    {
        return Result;
    }
    
    const TArray<TSharedPtr<FJsonValue>>* JsonArray;
    if (JsonObject->TryGetArrayField(FieldName, JsonArray) && JsonArray->Num() >= 3)
    {
        Result.X = (float)(*JsonArray)[0]->AsNumber();
        Result.Y = (float)(*JsonArray)[1]->AsNumber();
        Result.Z = (float)(*JsonArray)[2]->AsNumber();
    }
    
    return Result;
}

FRotator FUnrealMCPCommonUtils::GetRotatorFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName)
{
    FRotator Result(0.0f, 0.0f, 0.0f);
    
    if (!JsonObject->HasField(FieldName))
    {
        return Result;
    }
    
    const TArray<TSharedPtr<FJsonValue>>* JsonArray;
    if (JsonObject->TryGetArrayField(FieldName, JsonArray) && JsonArray->Num() >= 3)
    {
        Result.Pitch = (float)(*JsonArray)[0]->AsNumber();
        Result.Yaw = (float)(*JsonArray)[1]->AsNumber();
        Result.Roll = (float)(*JsonArray)[2]->AsNumber();
    }
    
    return Result;
}

// Blueprint Utilities
UBlueprint* FUnrealMCPCommonUtils::FindBlueprint(const FString& BlueprintName)
{
    return FindBlueprintByName(BlueprintName);
}

UBlueprint* FUnrealMCPCommonUtils::FindBlueprintByName(const FString& BlueprintName)
{
    FString AssetPath = TEXT("/Game/Blueprints/") + BlueprintName;
    return LoadObject<UBlueprint>(nullptr, *AssetPath);
}

UEdGraph* FUnrealMCPCommonUtils::FindOrCreateEventGraph(UBlueprint* Blueprint)
{
    if (!Blueprint)
    {
        return nullptr;
    }
    
    // Try to find the event graph
    for (UEdGraph* Graph : Blueprint->UbergraphPages)
    {
        if (Graph->GetName().Contains(TEXT("EventGraph")))
        {
            return Graph;
        }
    }
    
    // Create a new event graph if none exists
    UEdGraph* NewGraph = FBlueprintEditorUtils::CreateNewGraph(Blueprint, FName(TEXT("EventGraph")), UEdGraph::StaticClass(), UEdGraphSchema_K2::StaticClass());
    FBlueprintEditorUtils::AddUbergraphPage(Blueprint, NewGraph);
    return NewGraph;
}

// Blueprint node utilities
UK2Node_Event* FUnrealMCPCommonUtils::CreateEventNode(UEdGraph* Graph, const FString& EventName, const FVector2D& Position)
{
    if (!Graph)
    {
        return nullptr;
    }
    
    UBlueprint* Blueprint = FBlueprintEditorUtils::FindBlueprintForGraph(Graph);
    if (!Blueprint)
    {
        return nullptr;
    }
    
    // Check for existing event node with this exact name
    for (UEdGraphNode* Node : Graph->Nodes)
    {
        UK2Node_Event* EventNode = Cast<UK2Node_Event>(Node);
        if (EventNode && EventNode->EventReference.GetMemberName() == FName(*EventName))
        {
            UE_LOG(LogTemp, Display, TEXT("Using existing event node with name %s (ID: %s)"), 
                *EventName, *EventNode->NodeGuid.ToString());
            return EventNode;
        }
    }

    // No existing node found, create a new one
    UK2Node_Event* EventNode = nullptr;
    
    // Find the function to create the event
    UClass* BlueprintClass = Blueprint->GeneratedClass;
    UFunction* EventFunction = BlueprintClass->FindFunctionByName(FName(*EventName));
    
    if (EventFunction)
    {
        EventNode = NewObject<UK2Node_Event>(Graph);
        EventNode->EventReference.SetExternalMember(FName(*EventName), BlueprintClass);
        EventNode->NodePosX = Position.X;
        EventNode->NodePosY = Position.Y;
        Graph->AddNode(EventNode, true);
        EventNode->PostPlacedNewNode();
        EventNode->AllocateDefaultPins();
        UE_LOG(LogTemp, Display, TEXT("Created new event node with name %s (ID: %s)"), 
            *EventName, *EventNode->NodeGuid.ToString());
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("Failed to find function for event name: %s"), *EventName);
    }
    
    return EventNode;
}

UK2Node_CallFunction* FUnrealMCPCommonUtils::CreateFunctionCallNode(UEdGraph* Graph, UFunction* Function, const FVector2D& Position)
{
    if (!Graph || !Function)
    {
        return nullptr;
    }
    
    UK2Node_CallFunction* FunctionNode = NewObject<UK2Node_CallFunction>(Graph);
    FunctionNode->SetFromFunction(Function);
    FunctionNode->NodePosX = Position.X;
    FunctionNode->NodePosY = Position.Y;
    Graph->AddNode(FunctionNode, true);
    FunctionNode->CreateNewGuid();
    FunctionNode->PostPlacedNewNode();
    FunctionNode->AllocateDefaultPins();
    
    return FunctionNode;
}

UK2Node_VariableGet* FUnrealMCPCommonUtils::CreateVariableGetNode(UEdGraph* Graph, UBlueprint* Blueprint, const FString& VariableName, const FVector2D& Position)
{
    if (!Graph || !Blueprint)
    {
        return nullptr;
    }
    
    UK2Node_VariableGet* VariableGetNode = NewObject<UK2Node_VariableGet>(Graph);
    
    FName VarName(*VariableName);
    FProperty* Property = FindFProperty<FProperty>(Blueprint->GeneratedClass, VarName);
    
    if (Property)
    {
        VariableGetNode->VariableReference.SetFromField<FProperty>(Property, false);
        VariableGetNode->NodePosX = Position.X;
        VariableGetNode->NodePosY = Position.Y;
        Graph->AddNode(VariableGetNode, true);
        VariableGetNode->PostPlacedNewNode();
        VariableGetNode->AllocateDefaultPins();
        
        return VariableGetNode;
    }
    
    return nullptr;
}

UK2Node_VariableSet* FUnrealMCPCommonUtils::CreateVariableSetNode(UEdGraph* Graph, UBlueprint* Blueprint, const FString& VariableName, const FVector2D& Position)
{
    if (!Graph || !Blueprint)
    {
        return nullptr;
    }
    
    UK2Node_VariableSet* VariableSetNode = NewObject<UK2Node_VariableSet>(Graph);
    
    FName VarName(*VariableName);
    FProperty* Property = FindFProperty<FProperty>(Blueprint->GeneratedClass, VarName);
    
    if (Property)
    {
        VariableSetNode->VariableReference.SetFromField<FProperty>(Property, false);
        VariableSetNode->NodePosX = Position.X;
        VariableSetNode->NodePosY = Position.Y;
        Graph->AddNode(VariableSetNode, true);
        VariableSetNode->PostPlacedNewNode();
        VariableSetNode->AllocateDefaultPins();
        
        return VariableSetNode;
    }
    
    return nullptr;
}

UK2Node_InputAction* FUnrealMCPCommonUtils::CreateInputActionNode(UEdGraph* Graph, const FString& ActionName, const FVector2D& Position)
{
    if (!Graph)
    {
        return nullptr;
    }
    
    UK2Node_InputAction* InputActionNode = NewObject<UK2Node_InputAction>(Graph);
    InputActionNode->InputActionName = FName(*ActionName);
    InputActionNode->NodePosX = Position.X;
    InputActionNode->NodePosY = Position.Y;
    Graph->AddNode(InputActionNode, true);
    InputA
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Public/Commands/UnrealMCPCommonUtils.h`
```
#pragma once

#include "CoreMinimal.h"
#include "Json.h"

// Forward declarations
class AActor;
class UBlueprint;
class UEdGraph;
class UEdGraphNode;
class UEdGraphPin;
class UK2Node_Event;
class UK2Node_CallFunction;
class UK2Node_VariableGet;
class UK2Node_VariableSet;
class UK2Node_InputAction;
class UK2Node_Self;
class UFunction;

/**
 * Common utilities for UnrealMCP commands
 */
class UNREALMCP_API FUnrealMCPCommonUtils
{
public:
    // JSON utilities
    static TSharedPtr<FJsonObject> CreateErrorResponse(const FString& Message);
    static TSharedPtr<FJsonObject> CreateSuccessResponse(const TSharedPtr<FJsonObject>& Data = nullptr);
    static void GetIntArrayFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName, TArray<int32>& OutArray);
    static void GetFloatArrayFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName, TArray<float>& OutArray);
    static FVector2D GetVector2DFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName);
    static FVector GetVectorFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName);
    static FRotator GetRotatorFromJson(const TSharedPtr<FJsonObject>& JsonObject, const FString& FieldName);
    
    // Actor utilities
    static TSharedPtr<FJsonValue> ActorToJson(AActor* Actor);
    static TSharedPtr<FJsonObject> ActorToJsonObject(AActor* Actor, bool bDetailed = false);
    
    // Blueprint utilities
    static UBlueprint* FindBlueprint(const FString& BlueprintName);
    static UBlueprint* FindBlueprintByName(const FString& BlueprintName);
    static UEdGraph* FindOrCreateEventGraph(UBlueprint* Blueprint);
    
    // Blueprint node utilities
    static UK2Node_Event* CreateEventNode(UEdGraph* Graph, const FString& EventName, const FVector2D& Position);
    static UK2Node_CallFunction* CreateFunctionCallNode(UEdGraph* Graph, UFunction* Function, const FVector2D& Position);
    static UK2Node_VariableGet* CreateVariableGetNode(UEdGraph* Graph, UBlueprint* Blueprint, const FString& VariableName, const FVector2D& Position);
    static UK2Node_VariableSet* CreateVariableSetNode(UEdGraph* Graph, UBlueprint* Blueprint, const FString& VariableName, const FVector2D& Position);
    static UK2Node_InputAction* CreateInputActionNode(UEdGraph* Graph, const FString& ActionName, const FVector2D& Position);
    static UK2Node_Self* CreateSelfReferenceNode(UEdGraph* Graph, const FVector2D& Position);
    static bool ConnectGraphNodes(UEdGraph* Graph, UEdGraphNode* SourceNode, const FString& SourcePinName, 
                                UEdGraphNode* TargetNode, const FString& TargetPinName);
    static UEdGraphPin* FindPin(UEdGraphNode* Node, const FString& PinName, EEdGraphPinDirection Direction = EGPD_MAX);
    static UK2Node_Event* FindExistingEventNode(UEdGraph* Graph, const FString& EventName);

    // Property utilities
    static bool SetObjectProperty(UObject* Object, const FString& PropertyName, 
                                 const TSharedPtr<FJsonValue>& Value, FString& OutErrorMessage);
}; 
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPBlueprintCommands.cpp`
```
#include "Commands/UnrealMCPBlueprintCommands.h"
#include "Commands/UnrealMCPCommonUtils.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "Factories/BlueprintFactory.h"
#include "EdGraphSchema_K2.h"
#include "K2Node_Event.h"
#include "K2Node_VariableGet.h"
#include "K2Node_VariableSet.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Components/SphereComponent.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"
#include "UObject/Field.h"
#include "UObject/FieldPath.h"
#include "EditorAssetLibrary.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"

FUnrealMCPBlueprintCommands::FUnrealMCPBlueprintCommands()
{
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintCommands::HandleCommand(const FString& CommandType, const TSharedPtr<FJsonObject>& Params)
{
    if (CommandType == TEXT("create_blueprint"))
    {
        return HandleCreateBlueprint(Params);
    }
    else if (CommandType == TEXT("add_component_to_blueprint"))
    {
        return HandleAddComponentToBlueprint(Params);
    }
    else if (CommandType == TEXT("set_component_property"))
    {
        return HandleSetComponentProperty(Params);
    }
    else if (CommandType == TEXT("set_physics_properties"))
    {
        return HandleSetPhysicsProperties(Params);
    }
    else if (CommandType == TEXT("compile_blueprint"))
    {
        return HandleCompileBlueprint(Params);
    }
    else if (CommandType == TEXT("spawn_blueprint_actor"))
    {
        return HandleSpawnBlueprintActor(Params);
    }
    else if (CommandType == TEXT("set_blueprint_property"))
    {
        return HandleSetBlueprintProperty(Params);
    }
    else if (CommandType == TEXT("set_static_mesh_properties"))
    {
        return HandleSetStaticMeshProperties(Params);
    }
    else if (CommandType == TEXT("set_pawn_properties"))
    {
        return HandleSetPawnProperties(Params);
    }
    
    return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Unknown blueprint command: %s"), *CommandType));
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintCommands::HandleCreateBlueprint(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString BlueprintName;
    if (!Params->TryGetStringField(TEXT("name"), BlueprintName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'name' parameter"));
    }

    // Check if blueprint already exists
    FString PackagePath = TEXT("/Game/Blueprints/");
    FString AssetName = BlueprintName;
    if (UEditorAssetLibrary::DoesAssetExist(PackagePath + AssetName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Blueprint already exists: %s"), *BlueprintName));
    }

    // Create the blueprint factory
    UBlueprintFactory* Factory = NewObject<UBlueprintFactory>();
    
    // Handle parent class
    FString ParentClass;
    Params->TryGetStringField(TEXT("parent_class"), ParentClass);
    
    // Default to Actor if no parent class specified
    UClass* SelectedParentClass = AActor::StaticClass();
    
    // Try to find the specified parent class
    if (!ParentClass.IsEmpty())
    {
        FString ClassName = ParentClass;
        if (!ClassName.StartsWith(TEXT("A")))
        {
            ClassName = TEXT("A") + ClassName;
        }
        
        // First try direct StaticClass lookup for common classes
        UClass* FoundClass = nullptr;
        if (ClassName == TEXT("APawn"))
        {
            FoundClass = APawn::StaticClass();
        }
        else if (ClassName == TEXT("AActor"))
        {
            FoundClass = AActor::StaticClass();
        }
        else
        {
            // Try loading the class using LoadClass which is more reliable than FindObject
            const FString ClassPath = FString::Printf(TEXT("/Script/Engine.%s"), *ClassName);
            FoundClass = LoadClass<AActor>(nullptr, *ClassPath);
            
            if (!FoundClass)
            {
                // Try alternate paths if not found
                const FString GameClassPath = FString::Printf(TEXT("/Script/Game.%s"), *ClassName);
                FoundClass = LoadClass<AActor>(nullptr, *GameClassPath);
            }
        }

        if (FoundClass)
        {
            SelectedParentClass = FoundClass;
            UE_LOG(LogTemp, Log, TEXT("Successfully set parent class to '%s'"), *ClassName);
        }
        else
        {
            UE_LOG(LogTemp, Warning, TEXT("Could not find specified parent class '%s' at paths: /Script/Engine.%s or /Script/Game.%s, defaulting to AActor"), 
                *ClassName, *ClassName, *ClassName);
        }
    }
    
    Factory->ParentClass = SelectedParentClass;

    // Create the blueprint
    UPackage* Package = CreatePackage(*(PackagePath + AssetName));
    UBlueprint* NewBlueprint = Cast<UBlueprint>(Factory->FactoryCreateNew(UBlueprint::StaticClass(), Package, *AssetName, RF_Standalone | RF_Public, nullptr, GWarn));

    if (NewBlueprint)
    {
        // Notify the asset registry
        FAssetRegistryModule::AssetCreated(NewBlueprint);

        // Mark the package dirty
        Package->MarkPackageDirty();

        TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
        ResultObj->SetStringField(TEXT("name"), AssetName);
        ResultObj->SetStringField(TEXT("path"), PackagePath + AssetName);
        return ResultObj;
    }

    return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to create blueprint"));
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintCommands::HandleAddComponentToBlueprint(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString BlueprintName;
    if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'blueprint_name' parameter"));
    }

    FString ComponentType;
    if (!Params->TryGetStringField(TEXT("component_type"), ComponentType))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'type' parameter"));
    }

    FString ComponentName;
    if (!Params->TryGetStringField(TEXT("component_name"), ComponentName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'name' parameter"));
    }

    // Find the blueprint
    UBlueprint* Blueprint = FUnrealMCPCommonUtils::FindBlueprint(BlueprintName);
    if (!Blueprint)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Blueprint not found: %s"), *BlueprintName));
    }

    // Create the component - dynamically find the component class by name
    UClass* ComponentClass = nullptr;

    // Try to find the class with exact name first
    ComponentClass = FindObject<UClass>(ANY_PACKAGE, *ComponentType);
    
    // If not found, try with "Component" suffix
    if (!ComponentClass && !ComponentType.EndsWith(TEXT("Component")))
    {
        FString ComponentTypeWithSuffix = ComponentType + TEXT("Component");
        ComponentClass = FindObject<UClass>(ANY_PACKAGE, *ComponentTypeWithSuffix);
    }
    
    // If still not found, try with "U" prefix
    if (!ComponentClass && !ComponentType.StartsWith(TEXT("U")))
    {
        FString ComponentTypeWithPrefix = TEXT("U") + ComponentType;
        ComponentClass = FindObject<UClass>(ANY_PACKAGE, *ComponentTypeWithPrefix);
        
        // Try with both prefix and suffix
        if (!ComponentClass && !ComponentType.EndsWith(TEXT("Component")))
        {
            FString ComponentTypeWithBoth = TEXT("U") + ComponentType + TEXT("Component");
            ComponentClass = FindObject<UClass>(ANY_PACKAGE, *ComponentTypeWithBoth);
        }
    }
    
    // Verify that the class is a valid component type
    if (!ComponentClass || !ComponentClass->IsChildOf(UActorComponent::StaticClass()))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Unknown component type: %s"), *ComponentType));
    }

    // Add the component to the blueprint
    USCS_Node* NewNode = Blueprint->SimpleConstructionScript->CreateNode(ComponentClass, *ComponentName);
    if (NewNode)
    {
        // Set transform if provided
        USceneComponent* SceneComponent = Cast<USceneComponent>(NewNode->ComponentTemplate);
        if (SceneComponent)
        {
            if (Params->HasField(TEXT("location")))
            {
                SceneComponent->SetRelativeLocation(FUnrealMCPCommonUtils::GetVectorFromJson(Params, TEXT("location")));
            }
            if (Params->HasField(TEXT("rotation")))
            {
                SceneComponent->SetRelativeRotation(FUnrealMCPCommonUtils::GetRotatorFromJson(Params, TEXT("rotation")));
            }
            if (Params->HasField(TEXT("scale")))
            {
                SceneComponent->SetRelativeScale3D(FUnrealMCPCommonUtils::GetVectorFromJson(Params, TEXT("scale")));
            }
        }

        // Add to root if no parent specified
        Blueprint->SimpleConstructionScript->AddNode(NewNode);

        // Compile the blueprint
        FKismetEditorUtilities::CompileBlueprint(Blueprint);

        TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
        ResultObj->SetStringField(TEXT("component_name"), ComponentName);
        ResultObj->SetStringField(TEXT("component_type"), ComponentType);
        return ResultObj;
    }

    return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to add component to blueprint"));
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintCommands::HandleSetComponentProperty(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString BlueprintName;
    if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
    {
        return FUnrealMCPCommonUtils::CreateErrorRespon
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPBlueprintNodeCommands.cpp`
```
#include "Commands/UnrealMCPBlueprintNodeCommands.h"
#include "Commands/UnrealMCPCommonUtils.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphNode.h"
#include "EdGraph/EdGraphPin.h"
#include "K2Node_Event.h"
#include "K2Node_CallFunction.h"
#include "K2Node_VariableGet.h"
#include "K2Node_InputAction.h"
#include "K2Node_Self.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "GameFramework/InputSettings.h"
#include "Camera/CameraActor.h"
#include "Kismet/GameplayStatics.h"
#include "EdGraphSchema_K2.h"

// Declare the log category
DEFINE_LOG_CATEGORY_STATIC(LogUnrealMCP, Log, All);

FUnrealMCPBlueprintNodeCommands::FUnrealMCPBlueprintNodeCommands()
{
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintNodeCommands::HandleCommand(const FString& CommandType, const TSharedPtr<FJsonObject>& Params)
{
    if (CommandType == TEXT("connect_blueprint_nodes"))
    {
        return HandleConnectBlueprintNodes(Params);
    }
    else if (CommandType == TEXT("add_blueprint_get_self_component_reference"))
    {
        return HandleAddBlueprintGetSelfComponentReference(Params);
    }
    else if (CommandType == TEXT("add_blueprint_event_node"))
    {
        return HandleAddBlueprintEvent(Params);
    }
    else if (CommandType == TEXT("add_blueprint_function_node"))
    {
        return HandleAddBlueprintFunctionCall(Params);
    }
    else if (CommandType == TEXT("add_blueprint_variable"))
    {
        return HandleAddBlueprintVariable(Params);
    }
    else if (CommandType == TEXT("add_blueprint_input_action_node"))
    {
        return HandleAddBlueprintInputActionNode(Params);
    }
    else if (CommandType == TEXT("add_blueprint_self_reference"))
    {
        return HandleAddBlueprintSelfReference(Params);
    }
    else if (CommandType == TEXT("find_blueprint_nodes"))
    {
        return HandleFindBlueprintNodes(Params);
    }
    
    return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Unknown blueprint node command: %s"), *CommandType));
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintNodeCommands::HandleConnectBlueprintNodes(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString BlueprintName;
    if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'blueprint_name' parameter"));
    }

    FString SourceNodeId;
    if (!Params->TryGetStringField(TEXT("source_node_id"), SourceNodeId))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'source_node_id' parameter"));
    }

    FString TargetNodeId;
    if (!Params->TryGetStringField(TEXT("target_node_id"), TargetNodeId))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'target_node_id' parameter"));
    }

    FString SourcePinName;
    if (!Params->TryGetStringField(TEXT("source_pin"), SourcePinName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'source_pin' parameter"));
    }

    FString TargetPinName;
    if (!Params->TryGetStringField(TEXT("target_pin"), TargetPinName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'target_pin' parameter"));
    }

    // Find the blueprint
    UBlueprint* Blueprint = FUnrealMCPCommonUtils::FindBlueprint(BlueprintName);
    if (!Blueprint)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Blueprint not found: %s"), *BlueprintName));
    }

    // Get the event graph
    UEdGraph* EventGraph = FUnrealMCPCommonUtils::FindOrCreateEventGraph(Blueprint);
    if (!EventGraph)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to get event graph"));
    }

    // Find the nodes
    UEdGraphNode* SourceNode = nullptr;
    UEdGraphNode* TargetNode = nullptr;
    for (UEdGraphNode* Node : EventGraph->Nodes)
    {
        if (Node->NodeGuid.ToString() == SourceNodeId)
        {
            SourceNode = Node;
        }
        else if (Node->NodeGuid.ToString() == TargetNodeId)
        {
            TargetNode = Node;
        }
    }

    if (!SourceNode || !TargetNode)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Source or target node not found"));
    }

    // Connect the nodes
    if (FUnrealMCPCommonUtils::ConnectGraphNodes(EventGraph, SourceNode, SourcePinName, TargetNode, TargetPinName))
    {
        // Mark the blueprint as modified
        FBlueprintEditorUtils::MarkBlueprintAsModified(Blueprint);

        TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
        ResultObj->SetStringField(TEXT("source_node_id"), SourceNodeId);
        ResultObj->SetStringField(TEXT("target_node_id"), TargetNodeId);
        return ResultObj;
    }

    return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to connect nodes"));
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintNodeCommands::HandleAddBlueprintGetSelfComponentReference(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString BlueprintName;
    if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'blueprint_name' parameter"));
    }

    FString ComponentName;
    if (!Params->TryGetStringField(TEXT("component_name"), ComponentName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'component_name' parameter"));
    }

    // Get position parameters (optional)
    FVector2D NodePosition(0.0f, 0.0f);
    if (Params->HasField(TEXT("node_position")))
    {
        NodePosition = FUnrealMCPCommonUtils::GetVector2DFromJson(Params, TEXT("node_position"));
    }

    // Find the blueprint
    UBlueprint* Blueprint = FUnrealMCPCommonUtils::FindBlueprint(BlueprintName);
    if (!Blueprint)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Blueprint not found: %s"), *BlueprintName));
    }

    // Get the event graph
    UEdGraph* EventGraph = FUnrealMCPCommonUtils::FindOrCreateEventGraph(Blueprint);
    if (!EventGraph)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to get event graph"));
    }
    
    // We'll skip component verification since the GetAllNodes API may have changed in UE5.5
    
    // Create the variable get node directly
    UK2Node_VariableGet* GetComponentNode = NewObject<UK2Node_VariableGet>(EventGraph);
    if (!GetComponentNode)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to create get component node"));
    }
    
    // Set up the variable reference properly for UE5.5
    FMemberReference& VarRef = GetComponentNode->VariableReference;
    VarRef.SetSelfMember(FName(*ComponentName));
    
    // Set node position
    GetComponentNode->NodePosX = NodePosition.X;
    GetComponentNode->NodePosY = NodePosition.Y;
    
    // Add to graph
    EventGraph->AddNode(GetComponentNode);
    GetComponentNode->CreateNewGuid();
    GetComponentNode->PostPlacedNewNode();
    GetComponentNode->AllocateDefaultPins();
    
    // Explicitly reconstruct node for UE5.5
    GetComponentNode->ReconstructNode();
    
    // Mark the blueprint as modified
    FBlueprintEditorUtils::MarkBlueprintAsModified(Blueprint);

    TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
    ResultObj->SetStringField(TEXT("node_id"), GetComponentNode->NodeGuid.ToString());
    return ResultObj;
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintNodeCommands::HandleAddBlueprintEvent(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString BlueprintName;
    if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'blueprint_name' parameter"));
    }

    FString EventName;
    if (!Params->TryGetStringField(TEXT("event_name"), EventName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'event_name' parameter"));
    }

    // Get position parameters (optional)
    FVector2D NodePosition(0.0f, 0.0f);
    if (Params->HasField(TEXT("node_position")))
    {
        NodePosition = FUnrealMCPCommonUtils::GetVector2DFromJson(Params, TEXT("node_position"));
    }

    // Find the blueprint
    UBlueprint* Blueprint = FUnrealMCPCommonUtils::FindBlueprint(BlueprintName);
    if (!Blueprint)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Blueprint not found: %s"), *BlueprintName));
    }

    // Get the event graph
    UEdGraph* EventGraph = FUnrealMCPCommonUtils::FindOrCreateEventGraph(Blueprint);
    if (!EventGraph)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to get event graph"));
    }

    // Create the event node
    UK2Node_Event* EventNode = FUnrealMCPCommonUtils::CreateEventNode(EventGraph, EventName, NodePosition);
    if (!EventNode)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to create event node"));
    }

    // Mark the blueprint as modified
    FBlueprintEditorUtils::MarkBlueprintAsModified(Blueprint);

    TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
    ResultObj->SetStringField(TEXT("node_id"), EventNode->NodeGuid.ToString());
    return ResultObj;
}

TSharedPtr<FJsonObject> FUnrealMCPBlueprintNodeCommands::HandleAddBlueprintFunctionCall(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString BlueprintName;
    if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'blueprint_name' parameter"));
    }

    FString FunctionName;
    if (!Params->TryGetStringField(TEXT("function_name"), FunctionName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Miss
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPEditorCommands.cpp`
```
#include "Commands/UnrealMCPEditorCommands.h"
#include "Commands/UnrealMCPCommonUtils.h"
#include "Editor.h"
#include "EditorViewportClient.h"
#include "LevelEditorViewport.h"
#include "ImageUtils.h"
#include "HighResScreenshot.h"
#include "Engine/GameViewportClient.h"
#include "Misc/FileHelper.h"
#include "GameFramework/Actor.h"
#include "Engine/Selection.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/DirectionalLight.h"
#include "Engine/PointLight.h"
#include "Engine/SpotLight.h"
#include "Camera/CameraActor.h"
#include "Components/StaticMeshComponent.h"
#include "EditorSubsystem.h"
#include "Subsystems/EditorActorSubsystem.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"

FUnrealMCPEditorCommands::FUnrealMCPEditorCommands()
{
}

TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleCommand(const FString& CommandType, const TSharedPtr<FJsonObject>& Params)
{
    // Actor manipulation commands
    if (CommandType == TEXT("get_actors_in_level"))
    {
        return HandleGetActorsInLevel(Params);
    }
    else if (CommandType == TEXT("find_actors_by_name"))
    {
        return HandleFindActorsByName(Params);
    }
    else if (CommandType == TEXT("spawn_actor") || CommandType == TEXT("create_actor"))
    {
        if (CommandType == TEXT("create_actor"))
        {
            UE_LOG(LogTemp, Warning, TEXT("'create_actor' command is deprecated and will be removed in a future version. Please use 'spawn_actor' instead."));
        }
        return HandleSpawnActor(Params);
    }
    else if (CommandType == TEXT("delete_actor"))
    {
        return HandleDeleteActor(Params);
    }
    else if (CommandType == TEXT("set_actor_transform"))
    {
        return HandleSetActorTransform(Params);
    }
    else if (CommandType == TEXT("get_actor_properties"))
    {
        return HandleGetActorProperties(Params);
    }
    else if (CommandType == TEXT("set_actor_property"))
    {
        return HandleSetActorProperty(Params);
    }
    // Blueprint actor spawning
    else if (CommandType == TEXT("spawn_blueprint_actor"))
    {
        return HandleSpawnBlueprintActor(Params);
    }
    // Editor viewport commands
    else if (CommandType == TEXT("focus_viewport"))
    {
        return HandleFocusViewport(Params);
    }
    else if (CommandType == TEXT("take_screenshot"))
    {
        return HandleTakeScreenshot(Params);
    }
    
    return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Unknown editor command: %s"), *CommandType));
}

TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleGetActorsInLevel(const TSharedPtr<FJsonObject>& Params)
{
    TArray<AActor*> AllActors;
    UGameplayStatics::GetAllActorsOfClass(GWorld, AActor::StaticClass(), AllActors);
    
    TArray<TSharedPtr<FJsonValue>> ActorArray;
    for (AActor* Actor : AllActors)
    {
        if (Actor)
        {
            ActorArray.Add(FUnrealMCPCommonUtils::ActorToJson(Actor));
        }
    }
    
    TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
    ResultObj->SetArrayField(TEXT("actors"), ActorArray);
    
    return ResultObj;
}

TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleFindActorsByName(const TSharedPtr<FJsonObject>& Params)
{
    FString Pattern;
    if (!Params->TryGetStringField(TEXT("pattern"), Pattern))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'pattern' parameter"));
    }
    
    TArray<AActor*> AllActors;
    UGameplayStatics::GetAllActorsOfClass(GWorld, AActor::StaticClass(), AllActors);
    
    TArray<TSharedPtr<FJsonValue>> MatchingActors;
    for (AActor* Actor : AllActors)
    {
        if (Actor && Actor->GetName().Contains(Pattern))
        {
            MatchingActors.Add(FUnrealMCPCommonUtils::ActorToJson(Actor));
        }
    }
    
    TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
    ResultObj->SetArrayField(TEXT("actors"), MatchingActors);
    
    return ResultObj;
}

TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleSpawnActor(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString ActorType;
    if (!Params->TryGetStringField(TEXT("type"), ActorType))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'type' parameter"));
    }

    // Get actor name (required parameter)
    FString ActorName;
    if (!Params->TryGetStringField(TEXT("name"), ActorName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'name' parameter"));
    }

    // Get optional transform parameters
    FVector Location(0.0f, 0.0f, 0.0f);
    FRotator Rotation(0.0f, 0.0f, 0.0f);
    FVector Scale(1.0f, 1.0f, 1.0f);

    if (Params->HasField(TEXT("location")))
    {
        Location = FUnrealMCPCommonUtils::GetVectorFromJson(Params, TEXT("location"));
    }
    if (Params->HasField(TEXT("rotation")))
    {
        Rotation = FUnrealMCPCommonUtils::GetRotatorFromJson(Params, TEXT("rotation"));
    }
    if (Params->HasField(TEXT("scale")))
    {
        Scale = FUnrealMCPCommonUtils::GetVectorFromJson(Params, TEXT("scale"));
    }

    // Create the actor based on type
    AActor* NewActor = nullptr;
    UWorld* World = GEditor->GetEditorWorldContext().World();

    if (!World)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to get editor world"));
    }

    // Check if an actor with this name already exists
    TArray<AActor*> AllActors;
    UGameplayStatics::GetAllActorsOfClass(World, AActor::StaticClass(), AllActors);
    for (AActor* Actor : AllActors)
    {
        if (Actor && Actor->GetName() == ActorName)
        {
            return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Actor with name '%s' already exists"), *ActorName));
        }
    }

    FActorSpawnParameters SpawnParams;
    SpawnParams.Name = *ActorName;

    if (ActorType == TEXT("StaticMeshActor"))
    {
        NewActor = World->SpawnActor<AStaticMeshActor>(AStaticMeshActor::StaticClass(), Location, Rotation, SpawnParams);
    }
    else if (ActorType == TEXT("PointLight"))
    {
        NewActor = World->SpawnActor<APointLight>(APointLight::StaticClass(), Location, Rotation, SpawnParams);
    }
    else if (ActorType == TEXT("SpotLight"))
    {
        NewActor = World->SpawnActor<ASpotLight>(ASpotLight::StaticClass(), Location, Rotation, SpawnParams);
    }
    else if (ActorType == TEXT("DirectionalLight"))
    {
        NewActor = World->SpawnActor<ADirectionalLight>(ADirectionalLight::StaticClass(), Location, Rotation, SpawnParams);
    }
    else if (ActorType == TEXT("CameraActor"))
    {
        NewActor = World->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), Location, Rotation, SpawnParams);
    }
    else
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Unknown actor type: %s"), *ActorType));
    }

    if (NewActor)
    {
        // Set scale (since SpawnActor only takes location and rotation)
        FTransform Transform = NewActor->GetTransform();
        Transform.SetScale3D(Scale);
        NewActor->SetActorTransform(Transform);

        // Return the created actor's details
        return FUnrealMCPCommonUtils::ActorToJsonObject(NewActor, true);
    }

    return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to create actor"));
}

TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleDeleteActor(const TSharedPtr<FJsonObject>& Params)
{
    FString ActorName;
    if (!Params->TryGetStringField(TEXT("name"), ActorName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'name' parameter"));
    }

    TArray<AActor*> AllActors;
    UGameplayStatics::GetAllActorsOfClass(GWorld, AActor::StaticClass(), AllActors);
    
    for (AActor* Actor : AllActors)
    {
        if (Actor && Actor->GetName() == ActorName)
        {
            // Store actor info before deletion for the response
            TSharedPtr<FJsonObject> ActorInfo = FUnrealMCPCommonUtils::ActorToJsonObject(Actor);
            
            // Delete the actor
            Actor->Destroy();
            
            TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
            ResultObj->SetObjectField(TEXT("deleted_actor"), ActorInfo);
            return ResultObj;
        }
    }
    
    return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Actor not found: %s"), *ActorName));
}

TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleSetActorTransform(const TSharedPtr<FJsonObject>& Params)
{
    // Get actor name
    FString ActorName;
    if (!Params->TryGetStringField(TEXT("name"), ActorName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'name' parameter"));
    }

    // Find the actor
    AActor* TargetActor = nullptr;
    TArray<AActor*> AllActors;
    UGameplayStatics::GetAllActorsOfClass(GWorld, AActor::StaticClass(), AllActors);
    
    for (AActor* Actor : AllActors)
    {
        if (Actor && Actor->GetName() == ActorName)
        {
            TargetActor = Actor;
            break;
        }
    }

    if (!TargetActor)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Actor not found: %s"), *ActorName));
    }

    // Get transform parameters
    FTransform NewTransform = TargetActor->GetTransform();

    if (Params->HasField(TEXT("location")))
    {
        NewTransform.SetLocation(FUnrealMCPCommonUtils::GetVectorFromJson(Params, TEXT("location")));
    }
    if (Params->HasField(TEXT("rotation")))
    {
        NewTransform.SetRotation(FQuat(FUnrealMCPCommonUtils::GetRotatorFromJson(Params, TEXT("rotation"))));
    }
    if (Params->HasField(TEXT("scale")))
    {
        NewTransform.SetScale3D(FUnrealMCPCommonUtils::GetVectorFromJson(Params, TEXT("scale")));
    }

    // Set the new transform
    TargetActor->SetActorTransform(NewTransform);

    // Return updated actor info
    ret
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPProjectCommands.cpp`
```
#include "Commands/UnrealMCPProjectCommands.h"
#include "Commands/UnrealMCPCommonUtils.h"
#include "GameFramework/InputSettings.h"

FUnrealMCPProjectCommands::FUnrealMCPProjectCommands()
{
}

TSharedPtr<FJsonObject> FUnrealMCPProjectCommands::HandleCommand(const FString& CommandType, const TSharedPtr<FJsonObject>& Params)
{
    if (CommandType == TEXT("create_input_mapping"))
    {
        return HandleCreateInputMapping(Params);
    }
    
    return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Unknown project command: %s"), *CommandType));
}

TSharedPtr<FJsonObject> FUnrealMCPProjectCommands::HandleCreateInputMapping(const TSharedPtr<FJsonObject>& Params)
{
    // Get required parameters
    FString ActionName;
    if (!Params->TryGetStringField(TEXT("action_name"), ActionName))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'action_name' parameter"));
    }

    FString Key;
    if (!Params->TryGetStringField(TEXT("key"), Key))
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'key' parameter"));
    }

    // Get the input settings
    UInputSettings* InputSettings = GetMutableDefault<UInputSettings>();
    if (!InputSettings)
    {
        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to get input settings"));
    }

    // Create the input action mapping
    FInputActionKeyMapping ActionMapping;
    ActionMapping.ActionName = FName(*ActionName);
    ActionMapping.Key = FKey(*Key);

    // Add modifiers if provided
    if (Params->HasField(TEXT("shift")))
    {
        ActionMapping.bShift = Params->GetBoolField(TEXT("shift"));
    }
    if (Params->HasField(TEXT("ctrl")))
    {
        ActionMapping.bCtrl = Params->GetBoolField(TEXT("ctrl"));
    }
    if (Params->HasField(TEXT("alt")))
    {
        ActionMapping.bAlt = Params->GetBoolField(TEXT("alt"));
    }
    if (Params->HasField(TEXT("cmd")))
    {
        ActionMapping.bCmd = Params->GetBoolField(TEXT("cmd"));
    }

    // Add the mapping
    InputSettings->AddActionMapping(ActionMapping);
    InputSettings->SaveConfig();

    TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
    ResultObj->SetStringField(TEXT("action_name"), ActionName);
    ResultObj->SetStringField(TEXT("key"), Key);
    return ResultObj;
} 
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPUMGCommands.cpp`
```
#include "Commands/UnrealMCPUMGCommands.h"
#include "Commands/UnrealMCPCommonUtils.h"
#include "Editor.h"
#include "EditorAssetLibrary.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Blueprint/UserWidget.h"
#include "Components/TextBlock.h"
#include "WidgetBlueprint.h"
// We'll create widgets using regular Factory classes
#include "Factories/Factory.h"
// Remove problematic includes that don't exist in UE 5.5
// #include "UMGEditorSubsystem.h"
// #include "WidgetBlueprintFactory.h"
#include "WidgetBlueprintEditor.h"
#include "Blueprint/WidgetTree.h"
#include "Components/CanvasPanel.h"
#include "Components/CanvasPanelSlot.h"
#include "JsonObjectConverter.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Components/Button.h"
#include "K2Node_FunctionEntry.h"
#include "K2Node_CallFunction.h"
#include "K2Node_VariableGet.h"
#include "K2Node_VariableSet.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "K2Node_Event.h"

FUnrealMCPUMGCommands::FUnrealMCPUMGCommands()
{
}

TSharedPtr<FJsonObject> FUnrealMCPUMGCommands::HandleCommand(const FString& CommandName, const TSharedPtr<FJsonObject>& Params)
{
	if (CommandName == TEXT("create_umg_widget_blueprint"))
	{
		return HandleCreateUMGWidgetBlueprint(Params);
	}
	else if (CommandName == TEXT("add_text_block_to_widget"))
	{
		return HandleAddTextBlockToWidget(Params);
	}
	else if (CommandName == TEXT("add_widget_to_viewport"))
	{
		return HandleAddWidgetToViewport(Params);
	}
	else if (CommandName == TEXT("add_button_to_widget"))
	{
		return HandleAddButtonToWidget(Params);
	}
	else if (CommandName == TEXT("bind_widget_event"))
	{
		return HandleBindWidgetEvent(Params);
	}
	else if (CommandName == TEXT("set_text_block_binding"))
	{
		return HandleSetTextBlockBinding(Params);
	}

	return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Unknown UMG command: %s"), *CommandName));
}

TSharedPtr<FJsonObject> FUnrealMCPUMGCommands::HandleCreateUMGWidgetBlueprint(const TSharedPtr<FJsonObject>& Params)
{
	// Get required parameters
	FString BlueprintName;
	if (!Params->TryGetStringField(TEXT("name"), BlueprintName))
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'name' parameter"));
	}

	// Create the full asset path
	FString PackagePath = TEXT("/Game/Widgets/");
	FString AssetName = BlueprintName;
	FString FullPath = PackagePath + AssetName;

	// Check if asset already exists
	if (UEditorAssetLibrary::DoesAssetExist(FullPath))
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Widget Blueprint '%s' already exists"), *BlueprintName));
	}

	// Create package
	UPackage* Package = CreatePackage(*FullPath);
	if (!Package)
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to create package"));
	}

	// Create Widget Blueprint using KismetEditorUtilities
	UBlueprint* NewBlueprint = FKismetEditorUtilities::CreateBlueprint(
		UUserWidget::StaticClass(),  // Parent class
		Package,                     // Outer package
		FName(*AssetName),           // Blueprint name
		BPTYPE_Normal,               // Blueprint type
		UBlueprint::StaticClass(),   // Blueprint class
		UBlueprintGeneratedClass::StaticClass(), // Generated class
		FName("CreateUMGWidget")     // Creation method name
	);

	// Make sure the Blueprint was created successfully
	UWidgetBlueprint* WidgetBlueprint = Cast<UWidgetBlueprint>(NewBlueprint);
	if (!WidgetBlueprint)
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to create Widget Blueprint"));
	}

	// Add a default Canvas Panel if one doesn't exist
	if (!WidgetBlueprint->WidgetTree->RootWidget)
	{
		UCanvasPanel* RootCanvas = WidgetBlueprint->WidgetTree->ConstructWidget<UCanvasPanel>(UCanvasPanel::StaticClass());
		WidgetBlueprint->WidgetTree->RootWidget = RootCanvas;
	}

	// Mark the package dirty and notify asset registry
	Package->MarkPackageDirty();
	FAssetRegistryModule::AssetCreated(WidgetBlueprint);

	// Compile the blueprint
	FKismetEditorUtilities::CompileBlueprint(WidgetBlueprint);

	// Create success response
	TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
	ResultObj->SetStringField(TEXT("name"), BlueprintName);
	ResultObj->SetStringField(TEXT("path"), FullPath);
	return ResultObj;
}

TSharedPtr<FJsonObject> FUnrealMCPUMGCommands::HandleAddTextBlockToWidget(const TSharedPtr<FJsonObject>& Params)
{
	// Get required parameters
	FString BlueprintName;
	if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'blueprint_name' parameter"));
	}

	FString WidgetName;
	if (!Params->TryGetStringField(TEXT("widget_name"), WidgetName))
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'widget_name' parameter"));
	}

	// Find the Widget Blueprint
	FString FullPath = TEXT("/Game/Widgets/") + BlueprintName;
	UWidgetBlueprint* WidgetBlueprint = Cast<UWidgetBlueprint>(UEditorAssetLibrary::LoadAsset(FullPath));
	if (!WidgetBlueprint)
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Widget Blueprint '%s' not found"), *BlueprintName));
	}

	// Get optional parameters
	FString InitialText = TEXT("New Text Block");
	Params->TryGetStringField(TEXT("text"), InitialText);

	FVector2D Position(0.0f, 0.0f);
	if (Params->HasField(TEXT("position")))
	{
		const TArray<TSharedPtr<FJsonValue>>* PosArray;
		if (Params->TryGetArrayField(TEXT("position"), PosArray) && PosArray->Num() >= 2)
		{
			Position.X = (*PosArray)[0]->AsNumber();
			Position.Y = (*PosArray)[1]->AsNumber();
		}
	}

	// Create Text Block widget
	UTextBlock* TextBlock = WidgetBlueprint->WidgetTree->ConstructWidget<UTextBlock>(UTextBlock::StaticClass(), *WidgetName);
	if (!TextBlock)
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to create Text Block widget"));
	}

	// Set initial text
	TextBlock->SetText(FText::FromString(InitialText));

	// Add to canvas panel
	UCanvasPanel* RootCanvas = Cast<UCanvasPanel>(WidgetBlueprint->WidgetTree->RootWidget);
	if (!RootCanvas)
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Root Canvas Panel not found"));
	}

	UCanvasPanelSlot* PanelSlot = RootCanvas->AddChildToCanvas(TextBlock);
	PanelSlot->SetPosition(Position);

	// Mark the package dirty and compile
	WidgetBlueprint->MarkPackageDirty();
	FKismetEditorUtilities::CompileBlueprint(WidgetBlueprint);

	// Create success response
	TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
	ResultObj->SetStringField(TEXT("widget_name"), WidgetName);
	ResultObj->SetStringField(TEXT("text"), InitialText);
	return ResultObj;
}

TSharedPtr<FJsonObject> FUnrealMCPUMGCommands::HandleAddWidgetToViewport(const TSharedPtr<FJsonObject>& Params)
{
	// Get required parameters
	FString BlueprintName;
	if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Missing 'blueprint_name' parameter"));
	}

	// Find the Widget Blueprint
	FString FullPath = TEXT("/Game/Widgets/") + BlueprintName;
	UWidgetBlueprint* WidgetBlueprint = Cast<UWidgetBlueprint>(UEditorAssetLibrary::LoadAsset(FullPath));
	if (!WidgetBlueprint)
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Widget Blueprint '%s' not found"), *BlueprintName));
	}

	// Get optional Z-order parameter
	int32 ZOrder = 0;
	Params->TryGetNumberField(TEXT("z_order"), ZOrder);

	// Create widget instance
	UClass* WidgetClass = WidgetBlueprint->GeneratedClass;
	if (!WidgetClass)
	{
		return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Failed to get widget class"));
	}

	// Note: This creates the widget but doesn't add it to viewport
	// The actual addition to viewport should be done through Blueprint nodes
	// as it requires a game context

	// Create success response with instructions
	TSharedPtr<FJsonObject> ResultObj = MakeShared<FJsonObject>();
	ResultObj->SetStringField(TEXT("blueprint_name"), BlueprintName);
	ResultObj->SetStringField(TEXT("class_path"), WidgetClass->GetPathName());
	ResultObj->SetNumberField(TEXT("z_order"), ZOrder);
	ResultObj->SetStringField(TEXT("note"), TEXT("Widget class ready. Use CreateWidget and AddToViewport nodes in Blueprint to display in game."));
	return ResultObj;
}

TSharedPtr<FJsonObject> FUnrealMCPUMGCommands::HandleAddButtonToWidget(const TSharedPtr<FJsonObject>& Params)
{
	TSharedPtr<FJsonObject> Response = MakeShared<FJsonObject>();

	// Get required parameters
	FString BlueprintName;
	if (!Params->TryGetStringField(TEXT("blueprint_name"), BlueprintName))
	{
		Response->SetStringField(TEXT("error"), TEXT("Missing blueprint_name parameter"));
		return Response;
	}

	FString WidgetName;
	if (!Params->TryGetStringField(TEXT("widget_name"), WidgetName))
	{
		Response->SetStringField(TEXT("error"), TEXT("Missing widget_name parameter"));
		return Response;
	}

	FString ButtonText;
	if (!Params->TryGetStringField(TEXT("text"), ButtonText))
	{
		Response->SetStringField(TEXT("error"), TEXT("Missing text parameter"));
		return Response;
	}

	// Load the Widget Blueprint
	const FString BlueprintPath = FString::Printf(TEXT("/Game/Widgets/%s.%s"), *BlueprintName, *BlueprintName);
	UWidgetBlueprint* WidgetBlueprint = Cast<UWidgetBlueprint>(UEditorAssetLibrary::LoadAsset(BlueprintPath));
	if (!WidgetBlueprint)
	{
		Response->SetStringField(TEXT("error"), FString::Printf(TEXT("Failed to load Widget Blueprint: %s"), *BlueprintPath));
		return Response;
	}

	// Create Button widget
	UButton* Button = NewObject<UButton>(WidgetBlueprint->GeneratedClass->GetDefaultObject(), UButton::StaticClass(), *WidgetName);
	if (!Button)
	{
		Response->SetStringField(TEXT("error"), TEXT("Failed to create Button widget"));
		return Response;
	}

	// Set button text
	UTextBlock* ButtonTextBlock = NewObject<UTextBlock>(Button, UTextBlock::StaticClass(), *(WidgetName + TEXT("_Text")));
	if (ButtonTextBlock)
	{
		ButtonTextBlock->SetText(FText::FromString(But
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/MCPServerRunnable.cpp`
```
#include "MCPServerRunnable.h"
#include "UnrealMCPBridge.h"
#include "Sockets.h"
#include "SocketSubsystem.h"
#include "Interfaces/IPv4/IPv4Address.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonReader.h"
#include "JsonObjectConverter.h"
#include "Misc/ScopeLock.h"
#include "HAL/PlatformTime.h"

// Buffer size for receiving data
const int32 BufferSize = 8192;

FMCPServerRunnable::FMCPServerRunnable(UUnrealMCPBridge* InBridge, TSharedPtr<FSocket> InListenerSocket)
    : Bridge(InBridge)
    , ListenerSocket(InListenerSocket)
    , bRunning(true)
{
    UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Created server runnable"));
}

FMCPServerRunnable::~FMCPServerRunnable()
{
    // Note: We don't delete the sockets here as they're owned by the bridge
}

bool FMCPServerRunnable::Init()
{
    return true;
}

uint32 FMCPServerRunnable::Run()
{
    UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Server thread starting..."));
    
    while (bRunning)
    {
        // UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Waiting for client connection..."));
        
        bool bPending = false;
        if (ListenerSocket->HasPendingConnection(bPending) && bPending)
        {
            UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Client connection pending, accepting..."));
            
            ClientSocket = MakeShareable(ListenerSocket->Accept(TEXT("MCPClient")));
            if (ClientSocket.IsValid())
            {
                UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Client connection accepted"));
                
                // Set socket options to improve connection stability
                ClientSocket->SetNoDelay(true);
                int32 SocketBufferSize = 65536;  // 64KB buffer
                ClientSocket->SetSendBufferSize(SocketBufferSize, SocketBufferSize);
                ClientSocket->SetReceiveBufferSize(SocketBufferSize, SocketBufferSize);
                
                uint8 Buffer[8192];
                while (bRunning)
                {
                    int32 BytesRead = 0;
                    if (ClientSocket->Recv(Buffer, sizeof(Buffer), BytesRead))
                    {
                        if (BytesRead == 0)
                        {
                            UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Client disconnected (zero bytes)"));
                            break;
                        }

                        // Convert received data to string
                        Buffer[BytesRead] = '\0';
                        FString ReceivedText = UTF8_TO_TCHAR(Buffer);
                        UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Received: %s"), *ReceivedText);

                        // Parse JSON
                        TSharedPtr<FJsonObject> JsonObject;
                        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ReceivedText);
                        
                        if (FJsonSerializer::Deserialize(Reader, JsonObject))
                        {
                            // Get command type
                            FString CommandType;
                            if (JsonObject->TryGetStringField(TEXT("type"), CommandType))
                            {
                                // Execute command
                                FString Response = Bridge->ExecuteCommand(CommandType, JsonObject->GetObjectField(TEXT("params")));
                                
                                // Log response for debugging
                                UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Sending response: %s"), *Response);
                                
                                // Send response
                                int32 BytesSent = 0;
                                if (!ClientSocket->Send((uint8*)TCHAR_TO_UTF8(*Response), Response.Len(), BytesSent))
                                {
                                    UE_LOG(LogTemp, Warning, TEXT("MCPServerRunnable: Failed to send response"));
                                }
                                else {
                                    UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Response sent successfully, bytes: %d"), BytesSent);
                                }
                            }
                            else
                            {
                                UE_LOG(LogTemp, Warning, TEXT("MCPServerRunnable: Missing 'type' field in command"));
                            }
                        }
                        else
                        {
                            UE_LOG(LogTemp, Warning, TEXT("MCPServerRunnable: Failed to parse JSON from: %s"), *ReceivedText);
                        }
                    }
                    else
                    {
                        int32 LastError = (int32)ISocketSubsystem::Get()->GetLastErrorCode();
                        // Don't break the connection for WouldBlock error, which is normal for non-blocking sockets
                        bool bShouldBreak = true;
                        
                        // Check for "would block" error which isn't a real error for non-blocking sockets
                        if (LastError == SE_EWOULDBLOCK) 
                        {
                            UE_LOG(LogTemp, Verbose, TEXT("MCPServerRunnable: Socket would block, continuing..."));
                            bShouldBreak = false;
                            // Small sleep to prevent tight loop when no data
                            FPlatformProcess::Sleep(0.01f);
                        }
                        // Check for other transient errors we might want to tolerate
                        else if (LastError == SE_EINTR) // Interrupted system call
                        {
                            UE_LOG(LogTemp, Warning, TEXT("MCPServerRunnable: Socket read interrupted, continuing..."));
                            bShouldBreak = false;
                        }
                        else 
                        {
                            UE_LOG(LogTemp, Warning, TEXT("MCPServerRunnable: Client disconnected or error. Last error code: %d"), LastError);
                        }
                        
                        if (bShouldBreak)
                        {
                            break;
                        }
                    }
                }
            }
            else
            {
                UE_LOG(LogTemp, Warning, TEXT("MCPServerRunnable: Failed to accept client connection"));
            }
        }
        
        // Small sleep to prevent tight loop
        FPlatformProcess::Sleep(0.1f);
    }
    
    UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Server thread stopping"));
    return 0;
}

void FMCPServerRunnable::Stop()
{
    bRunning = false;
}

void FMCPServerRunnable::Exit()
{
}

void FMCPServerRunnable::HandleClientConnection(TSharedPtr<FSocket> InClientSocket)
{
    if (!InClientSocket.IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("MCPServerRunnable: Invalid client socket passed to HandleClientConnection"));
        return;
    }

    UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Starting to handle client connection"));
    
    // Set socket options for better connection stability
    InClientSocket->SetNonBlocking(false);
    UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Set socket to blocking mode"));
    
    // Properly read full message with timeout
    const int32 MaxBufferSize = 4096;
    uint8 Buffer[MaxBufferSize];
    FString MessageBuffer;
    
    UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Starting message receive loop"));
    
    while (bRunning && InClientSocket.IsValid())
    {
        // Log socket state
        bool bIsConnected = InClientSocket->GetConnectionState() == SCS_Connected;
        UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Socket state - Connected: %s"), 
               bIsConnected ? TEXT("true") : TEXT("false"));
        
        // Log pending data status before receive
        uint32 PendingDataSize = 0;
        bool HasPendingData = InClientSocket->HasPendingData(PendingDataSize);
        UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Before Recv - HasPendingData=%s, Size=%d"), 
               HasPendingData ? TEXT("true") : TEXT("false"), PendingDataSize);
        
        // Try to receive data with timeout
        int32 BytesRead = 0;
        bool bReadSuccess = false;
        
        UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Attempting to receive data..."));
        bReadSuccess = InClientSocket->Recv(Buffer, MaxBufferSize, BytesRead, ESocketReceiveFlags::None);
        
        UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Recv attempt complete - Success=%s, BytesRead=%d"), 
               bReadSuccess ? TEXT("true") : TEXT("false"), BytesRead);
        
        if (BytesRead > 0)
        {
            // Log raw data for debugging
            FString HexData;
            for (int32 i = 0; i < FMath::Min(BytesRead, 50); ++i)
            {
                HexData += FString::Printf(TEXT("%02X "), Buffer[i]);
            }
            UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Raw data (first 50 bytes hex): %s%s"), 
                   *HexData, BytesRead > 50 ? TEXT("...") : TEXT(""));
            
            // Convert and log received data
            Buffer[BytesRead] = 0; // Null terminate
            FString ReceivedData = UTF8_TO_TCHAR(Buffer);
            UE_LOG(LogTemp, Display, TEXT("MCPServerRunnable: Received data as string: '%s'"), *ReceivedData);
            
            // Append to message buffer
            MessageBuffer.Append(ReceivedData);
            
            // Process complete messages (messages are terminated with newline)
            if (MessageBuffer.Contains(TEXT("\n")))
            {
                U
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/UnrealMCPBridge.cpp`
```
#include "UnrealMCPBridge.h"
#include "MCPServerRunnable.h"
#include "Sockets.h"
#include "SocketSubsystem.h"
#include "HAL/RunnableThread.h"
#include "Interfaces/IPv4/IPv4Address.h"
#include "Interfaces/IPv4/IPv4Endpoint.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonWriter.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/DirectionalLight.h"
#include "Engine/PointLight.h"
#include "Engine/SpotLight.h"
#include "Camera/CameraActor.h"
#include "EditorAssetLibrary.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "JsonObjectConverter.h"
#include "GameFramework/Actor.h"
#include "Engine/Selection.h"
#include "Kismet/GameplayStatics.h"
#include "Async/Async.h"
// Add Blueprint related includes
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "Factories/BlueprintFactory.h"
#include "EdGraphSchema_K2.h"
#include "K2Node_Event.h"
#include "K2Node_VariableGet.h"
#include "K2Node_VariableSet.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Components/SphereComponent.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
// UE5.5 correct includes
#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"
#include "UObject/Field.h"
#include "UObject/FieldPath.h"
// Blueprint Graph specific includes
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphNode.h"
#include "EdGraph/EdGraphPin.h"
#include "K2Node_CallFunction.h"
#include "K2Node_InputAction.h"
#include "K2Node_Self.h"
#include "GameFramework/InputSettings.h"
#include "EditorSubsystem.h"
#include "Subsystems/EditorActorSubsystem.h"
// Include our new command handler classes
#include "Commands/UnrealMCPEditorCommands.h"
#include "Commands/UnrealMCPBlueprintCommands.h"
#include "Commands/UnrealMCPBlueprintNodeCommands.h"
#include "Commands/UnrealMCPProjectCommands.h"
#include "Commands/UnrealMCPCommonUtils.h"
#include "Commands/UnrealMCPUMGCommands.h"

// Default settings
#define MCP_SERVER_HOST "127.0.0.1"
#define MCP_SERVER_PORT 55557

UUnrealMCPBridge::UUnrealMCPBridge()
{
    EditorCommands = MakeShared<FUnrealMCPEditorCommands>();
    BlueprintCommands = MakeShared<FUnrealMCPBlueprintCommands>();
    BlueprintNodeCommands = MakeShared<FUnrealMCPBlueprintNodeCommands>();
    ProjectCommands = MakeShared<FUnrealMCPProjectCommands>();
    UMGCommands = MakeShared<FUnrealMCPUMGCommands>();
}

UUnrealMCPBridge::~UUnrealMCPBridge()
{
    EditorCommands.Reset();
    BlueprintCommands.Reset();
    BlueprintNodeCommands.Reset();
    ProjectCommands.Reset();
    UMGCommands.Reset();
}

// Initialize subsystem
void UUnrealMCPBridge::Initialize(FSubsystemCollectionBase& Collection)
{
    UE_LOG(LogTemp, Display, TEXT("UnrealMCPBridge: Initializing"));
    
    bIsRunning = false;
    ListenerSocket = nullptr;
    ConnectionSocket = nullptr;
    ServerThread = nullptr;
    Port = MCP_SERVER_PORT;
    FIPv4Address::Parse(MCP_SERVER_HOST, ServerAddress);

    // Start the server automatically
    StartServer();
}

// Clean up resources when subsystem is destroyed
void UUnrealMCPBridge::Deinitialize()
{
    UE_LOG(LogTemp, Display, TEXT("UnrealMCPBridge: Shutting down"));
    StopServer();
}

// Start the MCP server
void UUnrealMCPBridge::StartServer()
{
    if (bIsRunning)
    {
        UE_LOG(LogTemp, Warning, TEXT("UnrealMCPBridge: Server is already running"));
        return;
    }

    // Create socket subsystem
    ISocketSubsystem* SocketSubsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);
    if (!SocketSubsystem)
    {
        UE_LOG(LogTemp, Error, TEXT("UnrealMCPBridge: Failed to get socket subsystem"));
        return;
    }

    // Create listener socket
    TSharedPtr<FSocket> NewListenerSocket = MakeShareable(SocketSubsystem->CreateSocket(NAME_Stream, TEXT("UnrealMCPListener"), false));
    if (!NewListenerSocket.IsValid())
    {
        UE_LOG(LogTemp, Error, TEXT("UnrealMCPBridge: Failed to create listener socket"));
        return;
    }

    // Allow address reuse for quick restarts
    NewListenerSocket->SetReuseAddr(true);
    NewListenerSocket->SetNonBlocking(true);

    // Bind to address
    FIPv4Endpoint Endpoint(ServerAddress, Port);
    if (!NewListenerSocket->Bind(*Endpoint.ToInternetAddr()))
    {
        UE_LOG(LogTemp, Error, TEXT("UnrealMCPBridge: Failed to bind listener socket to %s:%d"), *ServerAddress.ToString(), Port);
        return;
    }

    // Start listening
    if (!NewListenerSocket->Listen(5))
    {
        UE_LOG(LogTemp, Error, TEXT("UnrealMCPBridge: Failed to start listening"));
        return;
    }

    ListenerSocket = NewListenerSocket;
    bIsRunning = true;
    UE_LOG(LogTemp, Display, TEXT("UnrealMCPBridge: Server started on %s:%d"), *ServerAddress.ToString(), Port);

    // Start server thread
    ServerThread = FRunnableThread::Create(
        new FMCPServerRunnable(this, ListenerSocket),
        TEXT("UnrealMCPServerThread"),
        0, TPri_Normal
    );

    if (!ServerThread)
    {
        UE_LOG(LogTemp, Error, TEXT("UnrealMCPBridge: Failed to create server thread"));
        StopServer();
        return;
    }
}

// Stop the MCP server
void UUnrealMCPBridge::StopServer()
{
    if (!bIsRunning)
    {
        return;
    }

    bIsRunning = false;

    // Clean up thread
    if (ServerThread)
    {
        ServerThread->Kill(true);
        delete ServerThread;
        ServerThread = nullptr;
    }

    // Close sockets
    if (ConnectionSocket.IsValid())
    {
        ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM)->DestroySocket(ConnectionSocket.Get());
        ConnectionSocket.Reset();
    }

    if (ListenerSocket.IsValid())
    {
        ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM)->DestroySocket(ListenerSocket.Get());
        ListenerSocket.Reset();
    }

    UE_LOG(LogTemp, Display, TEXT("UnrealMCPBridge: Server stopped"));
}

// Execute a command received from a client
FString UUnrealMCPBridge::ExecuteCommand(const FString& CommandType, const TSharedPtr<FJsonObject>& Params)
{
    UE_LOG(LogTemp, Display, TEXT("UnrealMCPBridge: Executing command: %s"), *CommandType);
    
    // Create a promise to wait for the result
    TPromise<FString> Promise;
    TFuture<FString> Future = Promise.GetFuture();
    
    // Queue execution on Game Thread
    AsyncTask(ENamedThreads::GameThread, [this, CommandType, Params, Promise = MoveTemp(Promise)]() mutable
    {
        TSharedPtr<FJsonObject> ResponseJson = MakeShareable(new FJsonObject);
        
        try
        {
            TSharedPtr<FJsonObject> ResultJson;
            
            if (CommandType == TEXT("ping"))
            {
                ResultJson = MakeShareable(new FJsonObject);
                ResultJson->SetStringField(TEXT("message"), TEXT("pong"));
            }
            // Editor Commands (including actor manipulation)
            else if (CommandType == TEXT("get_actors_in_level") || 
                     CommandType == TEXT("find_actors_by_name") ||
                     CommandType == TEXT("spawn_actor") ||
                     CommandType == TEXT("create_actor") ||
                     CommandType == TEXT("delete_actor") || 
                     CommandType == TEXT("set_actor_transform") ||
                     CommandType == TEXT("get_actor_properties") ||
                     CommandType == TEXT("set_actor_property") ||
                     CommandType == TEXT("spawn_blueprint_actor") ||
                     CommandType == TEXT("focus_viewport") || 
                     CommandType == TEXT("take_screenshot"))
            {
                ResultJson = EditorCommands->HandleCommand(CommandType, Params);
            }
            // Blueprint Commands
            else if (CommandType == TEXT("create_blueprint") || 
                     CommandType == TEXT("add_component_to_blueprint") || 
                     CommandType == TEXT("set_component_property") || 
                     CommandType == TEXT("set_physics_properties") || 
                     CommandType == TEXT("compile_blueprint") || 
                     CommandType == TEXT("set_blueprint_property") || 
                     CommandType == TEXT("set_static_mesh_properties") ||
                     CommandType == TEXT("set_pawn_properties"))
            {
                ResultJson = BlueprintCommands->HandleCommand(CommandType, Params);
            }
            // Blueprint Node Commands
            else if (CommandType == TEXT("connect_blueprint_nodes") || 
                     CommandType == TEXT("add_blueprint_get_self_component_reference") ||
                     CommandType == TEXT("add_blueprint_self_reference") ||
                     CommandType == TEXT("find_blueprint_nodes") ||
                     CommandType == TEXT("add_blueprint_event_node") ||
                     CommandType == TEXT("add_blueprint_input_action_node") ||
                     CommandType == TEXT("add_blueprint_function_node") ||
                     CommandType == TEXT("add_blueprint_get_component_node") ||
                     CommandType == TEXT("add_blueprint_variable"))
            {
                ResultJson = BlueprintNodeCommands->HandleCommand(CommandType, Params);
            }
            // Project Commands
            else if (CommandType == TEXT("create_input_mapping"))
            {
                ResultJson = ProjectCommands->HandleCommand(CommandType, Params);
            }
            // UMG Commands
            else if (CommandType == TEXT("create_umg_widget_blueprint") ||
                     CommandType == TEXT("add_text_block_to_widget") ||
                     CommandType == TEXT("add_button_to_widget") ||
                     CommandType == TEXT("bind_widget_event") ||
                     CommandType == TEXT("set_text_block_binding") ||
                     CommandType == TEXT("add_widget_to_viewport"))
```

### Core Architecture Module: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/UnrealMCPModule.cpp`
```
#include "UnrealMCPModule.h"
#include "UnrealMCPBridge.h"
#include "Modules/ModuleManager.h"
#include "EditorSubsystem.h"
#include "Editor.h"

#define LOCTEXT_NAMESPACE "FUnrealMCPModule"

void FUnrealMCPModule::StartupModule()
{
	UE_LOG(LogTemp, Display, TEXT("Unreal MCP Module has started"));
}

void FUnrealMCPModule::ShutdownModule()
{
	UE_LOG(LogTemp, Display, TEXT("Unreal MCP Module has shut down"));
}

#undef LOCTEXT_NAMESPACE
	
IMPLEMENT_MODULE(FUnrealMCPModule, UnrealMCP) 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2** (2025-04-01): **Pathing Inconsistency Issue**
  *Symptoms*: The MCP sometimes crashes editor with double slash paths, for example, when given the following input: ``` {   "blueprint_name": "/Game/MCPTest/Actors/BP_Player.BP_Player",   "component_type": "FloatingPawnMovement",   "component_name": "MovementComponent" } ``` it produces the following error ``` Fatal error: [File:D:\build\++UE5\Sync\Engine\Source\Runtime\CoreUObject\Private\UObject\UObjectGlobals.cpp] [Line: 1062]  Attempted to create a package with name containing double slashes. PackageName: /Game/Blueprints//Game/MCPTest/Actors/BP_Player ```  so i thought its just the matter of omitting the initial "/" from the paths. but when running the following: ``` {   "blueprint_name": "Game/MCPTest/Actors/BP_Player",   "component_type": "FloatingPawnMovement",   "component_name": "MovementComponent" } ``` the results is instead: ``` {"status": "error", "error": "Blueprint not found: BP_Player"} ```  looks like this might be caused by inconsistency in path handling?

- **Issue #1** (2025-04-02): **got error: Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)**
  *Symptoms*: <img width="491" alt="Image" src="https://github.com/user-attachments/assets/7eaef594-ffb0-46ff-8e6f-af3224983da8" />
  **Post-Mortem & Fix Analysis**:
  > but the mcp tools load fine into claude.
  > What MCP client are you using? Claude Desktop, Cursor, or Windsurf?   I see that in Cursor, too -- but does not have any effect on functionality. Are you able to call any tools successfully ?   Try get all actors in level, for example.  * Update * Just saw it carefully and it's Claude Desktop. I will debug and see what's going on...

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `4e5f00da` (2025-04-22)
**Commit Message**: Revert to state of commit fa7a84add6b414e3078ffd7d65033622eb28791f

**File**: `Python/PLAN.md` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-# Plan to Enable `uvx` Execution for Unreal MCP Server
-
-This document outlines the steps taken to restructure the Python project and configure `pyproject.toml` so that the `unreal_mcp_server.py` script can be executed using `uvx`.
-
-1.  **Update `pyproject.toml`:**
-    *   Added `[build-system]` section specifying `setuptools` as the build backend.
-    *   Defined `[project]` metadata including name (`unreal-mcp`), version, description, authors, Python requirement, and dependencies (`fastmcp`, etc.).
-    *   Added `[project.optional-dependencies]` for development tools.
-    *   Defined a script entry point under `[project.scripts]` mapping `unreal_mcp_server` to `unreal_mcp.unreal_mcp_server:main`.
-    *   Configured `[tool.setuptools.packages.find]` to locate the `unreal_mcp` package.
-
-2.  **Restructure Project into a Python Package:**
-    *   Created the main package directory: `Python/unreal_mcp/`.
-    *   Added an `__init__.py` file to `Python/unreal_mcp/` to mark it as a package.
-    *   Created subdirectories for modules: `Python/unreal_mcp/tools/` and `Python/unreal_mcp/unreal_bridge/`.
-    *   Added `__init__.py` files to `Python/unreal_mcp/tools/` and `Python/unreal_mcp/unreal_bridge/`.
-
-3.  **Modify Core Server Script:**
-    *   Moved the original `Python/unreal_mcp_server.py` to `Python/unreal_mcp/unreal_mcp_server.py`.
-    *   Refactored the script to include a `main()` function containing the server setup and execution logic (`uvicorn.run`).
-    *   Ensured the script uses relative imports where necessary (e.g., `from unreal_mcp.tool_registry import build_tool_registry`).
-
-4.  **Relocate and Create Supporting Modules:**
-    *   Moved `Python/tool_registry.py` to `Python/unreal_mcp/tool_registry.py`.
-    *   Created a minimal implementation for the Unreal bridge communication in `Python/unreal_mcp/unreal_bridge/unrealbridge.py`.
-    *   Created stub files for each tool category (`editor_tools.py`, `actor_tools.py`, etc.) within the `Python/unreal_mcp/tools/` directory, ensuring they import necessary components and define example tools using `@register_tool`.
-
-5.  **Add Documentation:**
-    *   Created `Python/README.md` explaining how to install the package (using `pip install -e .`) and run the server via the entry point (`unreal_mcp_server`) or `uvx`.
-
-**Outcome:**
-
-These changes transform the Python project into an installable package with a defined entry point. This allows tools like `pip` and `uvx` to install the package and execute the server script directly using the command `unreal_mcp_server` after installation or `uvx --from <repo> unreal_mcp_server`.
```

**File**: `Python/README.md` (modified, +19/-39)
```diff
@@ -4,52 +4,32 @@ Python bridge for interacting with Unreal Engine 5.5 using the Model Context Pro
 
 ## Setup
 
-### 1. Install `uv` if you haven't already:
-```bash
-# On Unix/macOS:
-curl -LsSf https://astral.sh/uv/install.sh | sh
-
-# On Windows (PowerShell):
-powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
-```
-
-### 2. Configuring your MCP Client
-
-Use the following configuration in your MCP client's config file:
-
-```json
-{
-  "mcpServers": {
-    "unrealMCP": {
-      "command": "uv",
-      "args": [
-        "--directory", 
-        "<path/to/your/repo/Python>", 
-        "run", 
-        "unreal_mcp_server"
-      ]
-    }
-  }
-}
-```
-
-You can find the value of `<path/to/your/repo/>` by running `pwd` in the root directory of the repository.
-
-## Configuration Locations
-
-The location of your MCP configuration file depends on your MCP client. Common locations include:
-
-- Cursor: `~/.cursor/mcp_config.json`
-- Claude Desktop: `~/.config/claude/mcp_config.json`
-- Windsurf: `~/.codeium/windsurf/mcp_config.json`
-- Other clients: Refer to your client's documentation
+1. Make sure Python 3.10+ is installed
+2. Install `uv` if you haven't already:
+   ```bash
+   curl -LsSf https://astral.sh/uv/install.sh | sh
+   ```
+3. Create and activate a virtual environment:
+   ```bash
+   uv venv
+   source .venv/bin/activate  # On Unix/macOS
+   # or
+   .venv\Scripts\activate     # On Windows
+   ```
+4. Install dependencies:
+   ```bash
+   uv pip install -e .
+   ```
+
+At this point, you can configure your MCP Client (Claude Desktop, Cursor, Windsurf) to use the Unreal MCP Server as per the [Configuring your MCP Client](README.md#configuring-your-mcp-client).
 
 ## Testing Scripts
 
 There are several scripts in the [scripts](./scripts) folder. They are useful for testing the tools and the Unreal Bridge via a direct connection. This means that you do not need to have an MCP Server running.
 
 You should make sure you have installed dependencies and/or are running in the `uv` virtual environment in order for the scripts to work.
 
+
 ## Troubleshooting
 
 - Make sure Unreal Engine editor is loaded loaded and running before running the server.
```

**File**: `Python/pyproject.toml` (modified, +8/-8)
```diff
@@ -1,22 +1,22 @@
 [project]
 name = "unreal-mcp"
-version = "0.2.0"
+version = "0.1.0"
 description = "Unreal MCP Server: A server for Unreal Engine integration via the Model Context Protocol (MCP)."
 readme = "README.md"
 requires-python = ">=3.10"
 dependencies = [
   "mcp[cli]>=1.4.1",
   "fastmcp>=0.2.0",
+  "uvicorn",
+  "fastapi",
   "pydantic>=2.6.1",
   "requests"
 ]
 
-[project.scripts]
-unreal_mcp_server = "unreal_mcp.server:mcp.run"
-
 [build-system]
-requires = ["hatchling"]
-build-backend = "hatchling.build"
+requires = ["setuptools>=42", "wheel"]
+build-backend = "setuptools.build_meta"
 
-[tool.hatch.build.targets.wheel]
-packages = ["unreal_mcp"]
+[tool.setuptools]
+# The main server script is a single-file module
+py-modules = ["unreal_mcp_server"] 
```

**File**: `Python/unreal_mcp/__init__.py` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-# Unreal MCP package
```

**File**: `Python/unreal_mcp/bridge/__init__.py` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-# Unreal Bridge package
```

**File**: `Python/unreal_mcp/bridge/unreal_bridge.py` (removed, +0/-105)
```diff
@@ -1,105 +0,0 @@
-#!/usr/bin/env python3
-
-"""Bridge to Unreal Engine."""
-
-import socket
-import json
-import logging
-from typing import Dict, Any, Optional
-
-# Global connection settings
-_host = "127.0.0.1"
-_port = 55557
-_connection: Optional[socket.socket] = None
-
-def initialize(host: str = "127.0.0.1", port: int = 55557) -> None:
-    """Initialize the Unreal bridge connection details."""
-    global _host, _port
-    _host = host
-    _port = port
-    logging.info(f"Unreal bridge configured for host={host}, port={port}")
-
-def _get_connection() -> socket.socket:
-    """Establish or return the existing socket connection."""
-    global _connection
-    if _connection is None:
-        try:
-            logging.info(f"Attempting to connect to Unreal bridge at {_host}:{_port}...")
-            _connection = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
-            _connection.settimeout(5.0) # Add a timeout
-            _connection.connect((_host, _port))
-            logging.info("Successfully connected to Unreal bridge.")
-        except socket.timeout:
-            logging.error(f"Connection timed out connecting to Unreal bridge at {_host}:{_port}")
-            _connection = None # Reset on timeout
-            raise ConnectionRefusedError(f"Timeout connecting to {_host}:{_port}")
-        except ConnectionRefusedError:
-            logging.error(f"Connection refused by Unreal bridge at {_host}:{_port}. Is Unreal Editor with the plugin running?")
-            _connection = None # Reset on failure
-            raise
-        except Exception as e:
-            logging.error(f"Unexpected error connecting to Unreal bridge: {e}")
-            _connection = None # Reset on failure
-            raise
-    return _connection
-
-def close_connection() -> None:
-    """Close the socket connection if it exists."""
-    global _connection
-    if _connection is not None:
-        try:
-            _connection.close()
-            logging.info("Closed connection to Unreal bridge.")
-        except Exception as e:
-            logging.error(f"Error closing connection: {e}")
-        finally:
-            _connection = None
-
-def send_command(command: Dict[str, Any]) -> Optional[Dict[str, Any]]:
-    """Send a command to the Unreal bridge and return the response."""
-    response_str = ""
-    try:
-        sock = _get_connection()
-        message = json.dumps(command) + "\n" # Ensure newline terminator
-        logging.debug(f"Sending command to Unreal: {message.strip()}")
-        sock.sendall(message.encode('utf-8'))
-
-        # Receive response
-        sock.settimeout(10.0) # Timeout for response
-        buffer = b""
-        while True:
-            chunk = sock.recv(4096)
-            if not chunk:
-                # Connection closed unexpectedly
-                logging.error("Connection closed by Unreal bridge while waiting for response.")
-                close_connection()
-                return None 
-            buffer += chunk
-            # Check if the buffer ends with a newline, indicating complete JSON message
-            if buffer.endswith(b'\n'):
-                response_str = buffer.decode('utf-8').strip()
-                logging.debug(f"Received response from Unreal: {response_str}")
-                break
-            # Add a safeguard against infinitely growing buffer if no newline is found
-            if len(buffer) > 1024 * 1024: # e.g., 1MB limit
-                logging.error("Response buffer exceeded limit without finding newline terminator.")
-                close_connection()
-                return None
-
-        if response_str:
-            return json.loads(response_str)
-        return None # Should not happen if newline is detected
-
-    except (ConnectionRefusedError, ConnectionResetError, BrokenPipeError, socket.timeout) as e:
-        logging.error(f"Network error communicating with Unreal bridge: {e}")
-        close_connection() # Close broken connection
-        return {"error": f"Network error: {e}"} # Return error dict
-    except json.JSONDecodeError as e:
-        logging.error(f"Error decoding JSON response from Unreal: {e}. Response: '{response_str}'")
-        # Don't close connection just for decode error, maybe next command works
-        return {"error": f"JSON decode error: {e}"}
-    except Exception as e:
-        logging.error(f"Unexpected error sending command to Unreal bridge: {e}")
-        close_connection() # Close connection on unknown error
-        return {"error": f"Unexpected error: {e}"}
-
```

**File**: `Python/unreal_mcp/server.py` (removed, +0/-301)
```diff
@@ -1,301 +0,0 @@
-"""
-Unreal Engine MCP Server
-
-A simple MCP server for interacting with Unreal Engine.
-"""
-
-import logging
-import socket
-import sys
-import json
-from mcp.server.fastmcp import FastMCP
-from unreal_mcp.bridge import unreal_bridge as ub
-from contextlib import asynccontextmanager
-from typing import AsyncIterator, Dict, Any, Optional
-
-# Configure logging with more detailed format
-logging.basicConfig(
-    level=logging.DEBUG,  # Change to DEBUG level for more details
-    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
-    handlers=[
-        logging.FileHandler('unreal_mcp.log'),
-        # logging.StreamHandler(sys.stdout) # Remove this handler to avoid JSON corruption
-    ]
-)
-logger = logging.getLogger("UnrealMCP")
-
-# Configuration
-UNREAL_HOST = "127.0.0.1"
-UNREAL_PORT = 55557
-
-class UnrealConnection:
-    """Connection to an Unreal Engine instance."""
-    
-    def __init__(self):
-        """Initialize the connection."""
-        self.socket = None
-        self.connected = False
-    
-    def connect(self) -> bool:
-        """Connect to the Unreal Engine instance."""
-        try:
-            if self.socket:
-                try:
-                    self.socket.close()
-                except:
-                    pass
-                self.socket = None
-            logger.info(f"Connecting to Unreal at {UNREAL_HOST}:{UNREAL_PORT}...")
-            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
-            self.socket.settimeout(5)
-            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
-            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
-            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)
-            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
-            self.socket.connect((UNREAL_HOST, UNREAL_PORT))
-            self.connected = True
-            logger.info("Connected to Unreal Engine")
-            return True
-        except Exception as e:
-            logger.error(f"Failed to connect to Unreal: {e}")
-            self.connected = False
-            return False
-    
-    def disconnect(self):
-        """Disconnect from the Unreal Engine instance."""
-        if self.socket:
-            try:
-                self.socket.close()
-            except:
-                pass
-        self.socket = None
-        self.connected = False
-
-    def receive_full_response(self, sock, buffer_size=4096) -> bytes:
-        """Receive a complete response from Unreal, handling chunked data."""
-        chunks = []
-        sock.settimeout(5)
-        try:
-            while True:
-                chunk = sock.recv(buffer_size)
-                if not chunk:
-                    if not chunks:
-                        raise Exception("Connection closed before receiving data")
-                    break
-                chunks.append(chunk)
-                data = b''.join(chunks)
-                try:
-                    json.loads(data.decode('utf-8'))
-                    logger.info(f"Received complete response ({len(data)} bytes)")
-                    return data
-                except json.JSONDecodeError:
-                    logger.debug("Received partial response, waiting for more data...")
-                    continue
-        except socket.timeout:
-            logger.warning("Socket timeout during receive")
-            if chunks:
-                data = b''.join(chunks)
-                try:
-                    json.loads(data.decode('utf-8'))
-                    logger.info(f"Using partial response after timeout ({len(data)} bytes)")
-                    return data
-                except:
-                    pass
-            raise Exception("Timeout receiving Unreal response")
-        except Exception as e:
-            logger.error(f"Error during receive: {str(e)}")
-            raise
-    
-    def send_command(self, command: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
-        """Send a command to Unreal Engine and get the response."""
-        if self.socket:
-            try:
-                self.socket.close()
-            except:
-                pass
-            self.socket = None
-            self.connected = False
-        if not self.connect():
-            logger.error("Failed to connect to Unreal Engine for command")
-            return None
-        try:
-            command_obj = {"type": command, "params": params or {}}
-            command_json = json.dumps(command_obj)
-            logger.info(f"Sending command: {command_json}")
-            self.socket.sendall(command_json.encode('utf-8'))
-            response_data = self.receive_full_response(self.socket)
-            response = json.loads(response_data.decode('utf-8'))
-            logger.info(f"Complete response from Unreal: {response}")
-            if response.get("status") == "error
```

**File**: `Python/unreal_mcp_server.py` (modified, +374/-23)
```diff
@@ -1,26 +1,377 @@
-#!/usr/bin/env python3
+"""
+Unreal Engine MCP Server
+
+A simple MCP server for interacting with Unreal Engine.
+"""
+
+import logging
+import socket
 import sys
-import warnings
-from unreal_mcp.server import mcp
-
-def main():
-    warnings.warn(
-        "\nDEPRECATION WARNING: Running unreal_mcp_server.py directly is deprecated.\n"
-        "Please update your MCP configuration to use the module entry point instead:\n\n"
-        "# Option 1: Direct from repository (Recommended)\n"
-        '{\n  "mcpServers": {\n    "unrealMCP": {\n'
-        '      "command": "uvx",\n'
-        '      "args": ["--from", "git+https://github.com/chongdashu/unreal-mcp#subdirectory=Python", "unreal_mcp_server"]\n'
-        "    }\n  }\n}\n\n"
-        "# Option 2: Local installation\n"
-        '{\n  "mcpServers": {\n    "unrealMCP": {\n'
-        '      "command": "uv",\n'
-        '      "args": ["--directory", "<path/to/repo>/Python", "run", "unreal_mcp_server"]\n'
-        "    }\n  }\n}",
-        DeprecationWarning,
-        stacklevel=2
-    )
-    return mcp.run()
+import json
+from contextlib import asynccontextmanager
+from typing import AsyncIterator, Dict, Any, Optional
+from mcp.server.fastmcp import FastMCP
+
+# Configure logging with more detailed format
+logging.basicConfig(
+    level=logging.DEBUG,  # Change to DEBUG level for more details
+    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
+    handlers=[
+        logging.FileHandler('unreal_mcp.log'),
+        # logging.StreamHandler(sys.stdout) # Remove this handler to unexpected non-whitespace characters in JSON
+    ]
+)
+logger = logging.getLogger("UnrealMCP")
+
+# Configuration
+UNREAL_HOST = "127.0.0.1"
+UNREAL_PORT = 55557
+
+class UnrealConnection:
+    """Connection to an Unreal Engine instance."""
+    
+    def __init__(self):
+        """Initialize the connection."""
+        self.socket = None
+        self.connected = False
+    
+    def connect(self) -> bool:
+        """Connect to the Unreal Engine instance."""
+        try:
+            # Close any existing socket
+            if self.socket:
+                try:
+                    self.socket.close()
+                except:
+                    pass
+                self.socket = None
+            
+            logger.info(f"Connecting to Unreal at {UNREAL_HOST}:{UNREAL_PORT}...")
+            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
+            self.socket.settimeout(5)  # 5 second timeout
+            
+            # Set socket options for better stability
+            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
+            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
+            
+            # Set larger buffer sizes
+            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)
+            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
+            
+            self.socket.connect((UNREAL_HOST, UNREAL_PORT))
+            self.connected = True
+            logger.info("Connected to Unreal Engine")
+            return True
+            
+        except Exception as e:
+            logger.error(f"Failed to connect to Unreal: {e}")
+            self.connected = False
+            return False
+    
+    def disconnect(self):
+        """Disconnect from the Unreal Engine instance."""
+        if self.socket:
+            try:
+                self.socket.close()
+            except:
+                pass
+        self.socket = None
+        self.connected = False
+
+    def receive_full_response(self, sock, buffer_size=4096) -> bytes:
+        """Receive a complete response from Unreal, handling chunked data."""
+        chunks = []
+        sock.settimeout(5)  # 5 second timeout
+        try:
+            while True:
+                chunk = sock.recv(buffer_size)
+                if not chunk:
+                    if not chunks:
+                        raise Exception("Connection closed before receiving data")
+                    break
+                chunks.append(chunk)
+                
+                # Process the data received so far
+                data = b''.join(chunks)
+                decoded_data = data.decode('utf-8')
+                
+                # Try to parse as JSON to check if complete
+                try:
+                    json.loads(decoded_data)
+                    logger.info(f"Received complete response ({len(data)} bytes)")
+                    return data
+                except json.JSONDecodeError:
+                    # Not complete JSON yet, continue reading
+                    logger.debug(f"Received partial response, waiting for more data...")
+                    continue
+                except Exception as e:
+                    logger.warning(f"Error processing response chunk: {str(e)}")
+                    continue
+        except socket.timeout:
+       
```

---

### Incident Patch 2: `be78230c` (2025-04-21)
**Commit Message**: Merge pull request #11 from zenoengine/fix/validate-assetpath-before-loadobject

fix/validate-assetpath-before-loadobject

**File**: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPEditorCommands.cpp` (modified, +13/-1)
```diff
@@ -412,7 +412,19 @@ TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleSpawnBlueprintActor(cons
     }
 
     // Find the blueprint
-    FString AssetPath = TEXT("/Game/Blueprints/") + BlueprintName;
+    if (BlueprintName.IsEmpty())
+    {
+        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Blueprint name is empty"));
+    }
+
+    FString Root      = TEXT("/Game/Blueprints/");
+    FString AssetPath = Root + BlueprintName;
+
+    if (!FPackageName::DoesPackageExist(AssetPath))
+    {
+        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Blueprint '%s' not found – it must reside under /Game/Blueprints"), *BlueprintName));
+    }
+
     UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *AssetPath);
     if (!Blueprint)
     {
```

---

### Incident Patch 3: `fa7a84ad` (2025-04-19)
**Commit Message**: fix/validate-assetpath-before-loadobject

**File**: `MCPGameProject/Plugins/UnrealMCP/Source/UnrealMCP/Private/Commands/UnrealMCPEditorCommands.cpp` (modified, +13/-1)
```diff
@@ -412,7 +412,19 @@ TSharedPtr<FJsonObject> FUnrealMCPEditorCommands::HandleSpawnBlueprintActor(cons
     }
 
     // Find the blueprint
-    FString AssetPath = TEXT("/Game/Blueprints/") + BlueprintName;
+    if (BlueprintName.IsEmpty())
+    {
+        return FUnrealMCPCommonUtils::CreateErrorResponse(TEXT("Blueprint name is empty"));
+    }
+
+    FString Root      = TEXT("/Game/Blueprints/");
+    FString AssetPath = Root + BlueprintName;
+
+    if (!FPackageName::DoesPackageExist(AssetPath))
+    {
+        return FUnrealMCPCommonUtils::CreateErrorResponse(FString::Printf(TEXT("Blueprint '%s' not found – it must reside under /Game/Blueprints"), *BlueprintName));
+    }
+
     UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *AssetPath);
     if (!Blueprint)
     {
```

#### Recent Merged Pull Requests:
- **PR #56** (closed): Chore/ue58 json api migration (@DONXAKer)
- **PR #49** (closed): docs: add cross-host install via agent-add (@pea3nut)
- **PR #44** (closed): feat: Add support for setting light color and intensity via MCP (@Bilski311)
- **PR #40** (closed): Ue 56 (@seymi-hafsia)
- **PR #39** (closed): Reorganize Cursor MCP setup, add version folders, update docs (@millsydotdev)
- **PR #22** (closed): Upgrade project to UE5.6 (@Uqbc9)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
