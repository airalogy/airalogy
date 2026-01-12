# Workflow数据结构

## 用户基于一个Workflow进行研究后完成一个Path的数据结构

在Airalogy Protocol中，由于Workflow是定义到`workflow`模板中，因此，其相关数据也应该存储`workflow`字段中：

```json
{
    "airalogy_record_id": "...",
    "record_id": "...",
    "version": 1,
    "metadata": {
        // ...
    },
    "data": {
        "workflow": {
            "<workflow_id>": { // <workflow_id>即该Workflow的ID
                // <workflow_data> 应用该Workflow后所产生的数据
            }
        }
    }
}
```

`<workflow_data>`的数据结构如下，注意该数据结构同时完全适配于AIRA Method。

```json
{
    "protocols_info": [ // 储存该Workflow的所有涉及的Protocols的信息
        { // 这里需要以对象的形式储存，是因为在AI系统中，AI系统会自动根据`protocol_id`来获取对应的Protocol的信息，并嵌入到该对象中，以便于AI系统进行分析
            "protocol_index": 0, // 用于标识该Protocol在Workflow中的位置
            "protocol_id": "...", 
            "protocol_version": "...", // 会自动获取该Protocol的版本信息，以确保版本稳定
            "airalogy_protocol_id": "...", // 如果是在Airalogy平台中使用Workflow，则该字段用于记录该Protocol在Airalogy平台中的唯一Airalogy Protocol ID；如果是在本地使用Workflow，则该字段可以留空（null）
            "protocol_data": { // 该字段用于储存该Protocol的相关数据。该数据结构与Protocol的数据结构相同
                "markdown": "...",
                "model": "...", // 如果没有为`null`
                "assigner": "...", // 如果没有为`null`
                "field_json_schema": {
                    // ...
                },
            }
        },
        {
            "protocol_index": 2,
            "protocol_id": "...",
            "protocol_version": "...",
            "airalogy_protocol_id": "...", // 如果是在Airalogy平台中使用Workflow，则该字段用于记录该Protocol在Airalogy平台中的唯一Airalogy Protocol ID；如果是在本地使用Workflow，则该字段可以留空（null）
            "protocol_data": { // 该字段用于储存该Protocol的相关数据。该数据结构与Protocol的数据结构相同
                "markdown": "...",
                "model": "...", // 如果没有为`null`
                "assigner": "...", // 如果没有为`null`
                "field_json_schema": {
                    // ...
                },
            }
        },
        // 以此类推，可以依次确定该Workflow中所有涉及的Protocols和具体应用时所基于的Airalogy Protocol
    ],
    "path_data": { // 每次Workflow的应用本质是产生了一个基于该Workflow的Path。因此Path所对应的具体数据，实际上就是Workflow的应用数据
        "path_status": "completed",
        // 由于一个Workflow在应用时，允许用户随时暂停或继续，因此需要一个字段记录当前Path的状态，以便系统在用户再次进入时，知道用户上次的操作状态。
        // 此外，该字段用于控制AI的行为，告知AI此时应该执行的过程。具体状态如下：
        //
        // - `completed`: 用户完成了该Workflow
        // - `waiting_for_research_goal`: 等待用户填写研究目的（Research Purpose, RG）
        // - `waiting_for_research_strategy`: 等待用户填写研究策略（Research Strategy, RS）。当处于该状态时，允许AI自动生成策略。
        // - `end_after_generating_research_strategy`: 该状态只会发生在使用AI自动生成研究策略之后。在生成研究策略之后结束，表明根据生成的策略，研究目的不可研究，导致路径结束
        // - `waiting_for_next_protocol`: 等待用户选择下一个Protocol
        // - `end_after_selecting_next_protocol`: 该状态只会在使用AI自动选择下一Protocol之后。在生成下一个研究节点后路径结束，意味着AI生成的下一单元为终止路径（End）
        // - `waiting_for_initial_values_for_fields_in_next_protocol`: 等待AI生成下一个研究节点的初始参数，通常包括实验的起始条件
        // - `waiting_for_record`: 该状态只会在确定了下一Protocol之后，此时需要等待用户基于该Protocol进行相关的科研活动并获取其对应的Record
        // - `waiting_for_phased_research_conclusion`: 等待用户总结/AI生成当前到达的Protocol及之前的研究结论，以便于进一步分析或调整策略。
        // - `waiting_for_final_research_conclusion`: 等待用户总结/AI生成整个Path的最终研究结论，完成整个研究流程

        "steps": [ 
            // 用于储存该Path的所有Protocol应用相关的数据。这里之所以把设计为列表形式，并把不同的步骤类型分开，其本质在于：1. 能够支持无限长度的Path；2. 便于AI设计。这样AI的目标实际上变为，始终生成列表中的下一个元素。另一方面，这种涉及方面我们未来如果有需求要扩展AIAR过程，并插入一些其他的中介构成，则也很容易扩展

            // 每个step都是一个对象，包含以下字段：
            // - `step`：用于标识当前步骤的类型。里面的类型都是用动词短语来表示的，以便于理解
            // - `path_index`：用于标识当前Step在Path中的位置
            // - `mode`：`ai` / `user`
            // - `data`：当前节点的数据。为了保证数据的一致性，我们都将其值设计为一个对象

            {
                "step": "add_research_goal",
                "path_index": 0, // 0表示该Step处于Path的准备阶段
                "mode": "user", // 可以为`ai`或`user`。如果是AI生成的，则该字段为`ai`；如果用户直接填写，则该字段为`user`
                "data": {
                    "thought": "...", // 为AI预留的，先思考，后做决策。如果是用户直接填写的，则该字段为null
                    "goal": "..." // 用户填写/AI生成的研究目的
                }
            },
            {
                "step": "add_research_strategy",
                "path_index": 0,
                "mode": "ai", // ai / user。如果AI判断了是否可研究，并生成了RS，但用户修改了，则该字段为`user`；如果AI生成了RS，用户没有修改，则该字段为`ai`
                "data": {
                    "thought": "...", // 为AI预留的，先思考，后做决策。如果是用户直接填写的，则该字段为null"
                    "researchable": true, // 在生成RS之前，先要检查该RG是否是该Workflow下可研究的。若不可研究，则不生成RS。在前端有3种选择：1. 未确认；2. 可研究；3. 不可研究，分别对应值为null, true, false。如果用户没有点击AI按钮，进行AI推荐，且也没有手动选择，则默认为null
                    "strategy": "..." // 用户填写/AI生成的RS
                }
            }
            {
                "step": "add_next_protocol", // 取名`add_next_protocol`因为无论是AI推荐的还是用户手动选择的下一个Protocol，`add`这个词的含义都适用
                "path_index": 1, // 用于标识当前Step在Path中的位置。1表示该Step处于Path的第一个Protocol相关的阶段

                "mode": "ai", // 用于标识当前Protocol是由AI推荐的还是用户手动选择的。这里的`ai`和`user`是两个固定的值，用于标识AI和用户的操作。如果是AI推荐的，则该字段为`ai`；如果用户在AI推荐的基础上进行了修改，则该字段为`user`。这样每个mode为`user`的step可以被视为一次RLHF的监督信号

                "data": {
                    "thought": "...", // 为AI预留的，先思考，后做决策。如果是用户直接选择的，则该字段为null
                    "end_path": false,
                    "protocol_index": 0, // 用于标志下一个Protocol的index
                }
            },
            {
                "step": "add_initial_values_for_fields_in_next_protocol",
                "path_index": 1,
                "mode": "ai", // 如果是AI生成的，且用户没有修改，则该字段为`ai`；如果用户在AI生成的基础上进行了修改，则该字段为`user`
                "data": {
                    "thought": "...", 
                    "values": {
                        "field_a": "...",
                        "field_b": "...",
                        // ...
                    }
                }
            },
            {
                "step": "record_protocol",
                "path_index": 1,
                "mode": "user", // 当前为只能为`user`，因为需要用户进行实际的科研活动，以获取Record。未来可能拓展`auto`模式，即通过自动化的方式获取Record
                "data": {
                    "protocol_index": 0, // 用于标识当前Protocol在Workflow中的位置
                    "record_id": "01234567-0123-0123-0123-0123456789ab", // 用户基于该Protocol进行科研活动后所产生的Record的ID。该Record ID是全局唯一的，因此可以唯一确定一个Record。
                    "record_version": 2, // 用户基于该Protocol进行科研活动后所产生的Record的版本号，即第几次更新。首次提交时，此值为1；当用户更新Record时，此值递增
                    "airalogy_record_id": "airalogy.id.record...", // 用于标识当前Record的ID。Airalogy Record ID是全局唯一的，因此可以唯一确定一个Record。
                    
                    // 这里需要注意的是，在Workflow的数据中，我们并不会重新储存一次Record的数据，而是直接引用Record的ID。这是因为Record的数据实际上是储存在其对应的Protocol中的，因此我们只需要引用Record的ID即可。这样做的好处是，可以减少数据冗余，提高数据的一致性。
                    // 需要注意，如果对应Protocol中该Record ID相关的数据被删除了，那么这里的引用就会失效，展示为空。这是因为我们的设计是，如果一个Record被删除了，那么其对应的Record ID也会被删除，以确保数据的一致性。因此，每当用户将要删除一个Record时，系统会提示用户是否要删除该Record ID，以确保用户明确自己的操作。

                    // 在Airalogy平台中，当使用AIRA方法时，数据会根据ID加载进来
                }
            },
            {
                "step": "add_phased_research_conclusion", // 这里之所以取名`add_phased_research_conclusion`而非`generate_phased_research_conclusion`，是因为在真实Path中，Phase Research Conclusion可以是用户自己填写的，也可以是AI生成的。因此，该类型无论是用户填写还是AI生成，该类型step都会出现
                "path_index": 1,
                "mode": "ai", // 如果是AI生成的，且用户没有修改，则该字段为`ai`；如果用户在AI生成的基础上进行了修改，则该字段为`user`；如果用户直接填写，则该字段为`user`
                "data": {
                    // 用于总结当前到当前节点为止的研究结论
                    "conclusion": "..."
                }
            },
            // add_next_protocol
            // add_initial_values_for_fields_in_next_protocol
            // * record_protocol
            // add_phased_research_conclusion
            // add_next_protocol
            // add_initial_values_for_fields_in_next_protocol
            // * record_protocol
            // add_phased_research_conclusion
            // ... 重复上述步骤，直到用户完成整个Path。注意，这里的`*`表示该step一定是需要的（因为Workflow的本质即一个个Protocol的连续应用，对应的就是产生了一个个的Record），而其他的step则根据用户的操作情况来决定是否需要
            {
                "step": "add_next_protocol",
                "path_index": 100, // 用于标识当前Step在Path中的位置。100表示该Step处于Path的第100个Protocol相关的阶段
                "mode": "ai",
                "data": {
                    "thought": "...",
                    "end_path": true, // 当出现`end_path`为true时，表示当前Path结束
                    "protocol_index": null
                }
            },
            {
                "step": "add_final_research_conclusion", // 这里之所以取名`add_final_research_conclusion`而非`generate_final_research_conclusion`，是因为在真实Path中，Final Research Conclusion可以是用户自己填写的，也可以是AI生成的。因此，该类型无论是用户填写还是AI生成，该类型step都会出现。注意当出现该类型step时，`path_status`一定为`completed`
                "path_index": 100, // 总是和END状态的`add_next_protocol`的`path_index`相同
                "mode": "ai", // 如果是AI生成的，且用户没有修改，则该字段为`ai`；如果用户在AI生成的基础上进行了修改，则该字段为`user`；如果用户直接填写，则该字段为`user`
                "data": {
                    // 用于总结整个Path的最终研究结论
                    "conclusion": "..."
                }
            }
        ]
    }
}
```
