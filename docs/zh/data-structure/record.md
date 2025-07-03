# 基于Airalogy Protocol记录获得的科研数据的数据结构

基于Airalogy Protocol记录获得的一条科研记录被称为一条Airalogy Record。

## General Structure

An Airalogy Record is a JSON object that contains the metadata and data of a research record. The general structure of an Airalogy Record is as follows:

```json
{
    "airalogy_record_id": "airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.v.2",
    "record_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // 该Record在record命名空间下唯一标识一个Record的ID
    "record_version": 2, // 该Record的版本号，即第几次更新。首次提交时，此值为1；当用户更新Record时，此值递增
    "metadata": {
        // metadata of the Record
    },
    "data": {
        // data of the Record
    }
}
```

关于Airalogy Record / Airalogy Protocol的ID设计说明，请参考[Airalogy ID](id.md)。

## Metadata

元数据包括：

```json
{
    // 下面字段用于标识该Record所基于的Airalogy Protocol
    "airalogy_protocol_id": "airalogy.id.lab.lab_demo.project.project_demo.protocol.protocol_demo.v.0.0.1",

    // 下面几个字段用于帮助用户快速定位Record在Airalogy Platform中的来源
    "lab_id": "lab_demo",
    "project_id": "project_demo",
    "protocol_id": "protocol_demo",
    "protocol_version": "0.0.1",
    "record_num": 1,

    // 下面4个字段用于标识该Record的版本信息
    "record_current_version_submission_time": "2024-01-02T00:00:00+08:00", // 该Record当前版本的提交时间
    "record_current_version_submission_user_id": "user_demo_2", // 该Record当前版本的提交用户ID
    "record_initial_version_submission_time": "2024-01-01T00:00:00+08:00", // 该Record初始版本的提交时间
    "record_initial_version_submission_user_id": "user_demo_1", // 该Record初始版本的提交用户ID
    
    // 用于校验Record数据的hash值，确保数据的完整性。这里我们使用SHA-1算法，但实际上可以使用任意hash算法，如SHA-256等。在当前的Airalogy系统中，我们使用SHA-1算法的原因在于相比于SHA-256，SHA-1的计算速度更快，更适合用于大量数据的hash计算。
    "sha1": "c486349125db2a468172a4449b9e309b0c756c59"
}
```

## Data

在Airalogy框架下，基于每个Airalogy Protocol记录Record，其本质上是在记录此Protocol下的每种模板下的内嵌值（即各Airalogy Fields的值）。因此，我们可以将Record视为一个具有嵌套结构的数据。

为了实现不同Airalogy Protocol下Record数据的通用储存，Record以JSON格式进行储存，其一般性结构如下（注：这里的数据结构不包含Record的元数据，只包含Record的data fields相关数据）：

```jsonc
{
    "template_name_1": {
        // data for template_name_1
    },

    "template_name_2": {
        // data for template_name_2
    }

    // ...
}
```

在此json的1级键值对中，每个键值对的键总是一个模板名，其名和AIMD模板中的`<template_name>`相对应。而每个键值对的值则通常是一个JSON对象。该对象的数据结构根据不同模板的定义而异。

下述不同模板的数据结构：

### Variable (`var`)

```jsonc
{
    "var": { // template_name = "var"

        // Var的值可以为任何JSON支持的数据类型
        // 该object将根据VarModel的定义进行校验约束，凡是能够保存进入数据库的数据，都是VarModel校验通过的数据

        "var_id_1": "value_1", // string
        "var_id_2": 1, // integer
        "var_id_3": 1.1, // float
        "var_id_4": true, // boolean
        "var_id_5": null, // null

        // Here are some complex data types
        "var_id_7": {
            // object value
        },
        "var_id_6": [
            // array value
        ],

        "datetime": "2024-01-01T00:00:00+08:00",
        "img_airalogy_id": "airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.png",
        "record_airalogy_id": "airalogy.id.record.yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy.v.1"
        // ...
    }
}
```

### Step (`step`)

```jsonc
{
    "step": { // template_name = "step"

        "step_id_1": {
            "annotation": "", // step的初始化注释值总是为空字符串。如果用户没有在前端step注释框中输入任何内容，则此值仍然为""
            "checked": null // 当AIMD中未启用`check`时，此字段为null
        },

        "step_id_2": {
            "annotation": "annotation_2", // 当有step过程注释时，此值为用户输入的注释内容。
            "checked": null 
        },

        "step_id_3": {
            "annotation": "",
            "checked": false // 如果用户在AIMD中定义step时启用了`check`参数，则此值默认为false
        },

        "step_id_4": {
            "annotation": "",
            "checked": true // 如果用户在AIMD中定义Step时启用了`check`参数，并确实在前端的step检查框中打勾了，则此值为true
        },

        // ...

    }
}
```

### Checkpoint (`check`)

```jsonc
{
    "check": { // template_name = "check"

        "check_id_1": {
            "checked": false, // 默认值为false。注意check的目的就是check，因此其校验默认为bool类型，而不可能为null
            "annotation": "" // 默认值为""
        },

        "check_id_2": {
            "checked": false,
            "annotation": "annotation_2" // 在用户校验某些check时可能出现校验不通过的情况，此时用户可以在此字段中注释校验不通过的原因。
        },
        "check_id_3": {
            "checked": true, // 当用户在前端的check检查框中打勾时，此值为true
            "annotation": ""
        },
        "check_id_4": {
            "checked": true,
            "annotation": "annotation_4" // 当然，即使校验通过，用户也可以在此字段中添加注释
        }

        // ...
    }
}
```

## Example

当用户试图下载一条Record时，Airalogy平台将返回一个JSON对象，其结构如下：

```json
{
    "airalogy_record_id": "airalogy.id.record.01234567-0123-0123-0123-0123456789ab.v.2",
    "record_id": "01234567-0123-0123-0123-0123456789ab",
    "record_version": 2,
    "metadata": {
        "airalogy_protocol_id": "airalogy.id.lab.lab_demo.project.project_demo.protocol.protocol_demo.v.0.0.1",
        "lab_id": "lab_demo",
        "project_id": "project_demo",
        "protocol_id": "protocol_demo",
        "protocol_version": "0.0.1",
        "record_num": 1,
        "record_current_version_submission_time": "2024-01-02T00:00:00+08:00",
        "record_current_version_submission_user_id": "user_demo_2",
        "record_initial_version_submission_time": "2024-01-01T00:00:00+08:00",
        "record_initial_version_submission_user_id": "user_demo_1",
        "sha1": "c486349125db2a468172a4449b9e309b0c756c59"
    },
    "data": {
        "var": {
            "solvent_name": "H2O",
            "solvent_volume": 1.0
        },
        "step": {
            "select_solvent": {
                "annotation": "",
                "checked": null
            }
        },
        "check": {
            "check_remaining_volume": {
                "annotation": "",
                "checked": true
            }
        }
    }
}
```

注意：

- 对于含有多模态数据的Record，其JSON中实际上通常储存的是每个模态数据的ID，而不是实际的数据（这防止Record的文件大小过大导致传输困难）。因此，用户在简单下载Record时，得到的JSON是只含有ID的JSON。而当用户需要查看具体的数据时，需要通过ID去数据库中查询具体的数据。如果用户想要下载包含具体数据的Record，需要通过系统的导出功能来实现。
- `sha1`的值通过

  ```py
  from airalogy.record.hash import get_data_sha1
  ```

  函数计算上述Record的`data`字段的SHA-1值得到。
