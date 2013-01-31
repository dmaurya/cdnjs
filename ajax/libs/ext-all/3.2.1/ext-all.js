Ext.ns("calms.question.details.grading.rubrics");

calms.question.details.grading.rubrics.Container = Ext.extend(Ext.Panel, {
    
    border: false,
    bodyCssClass: "rubrics-wrap",
    
    title: " ", //Dummy
    
    initComponent: function() {
        
        this.plugins = [
            new Ext.ux.GroupingPanel(),
            new Ext.ux.HeaderActions()
        ];
        
        this.rows = this.rows + 1;
        this.columns = this.columns + 1;
        
        this.items = [ this.createRubric() ];
        
        this.listeners = {
            scope: this,
            afterrender: this.refreshActions,
            addcolumn: this.addColumn,
            removecolumn: this.removeColumn,
            addrow: this.addRow,
            removerow: this.removeRow,
            columnreorder: this.columnReorder,
            rowreorder: this.rowReorder,
            distributeevently: this.distributePoints,
            
            /* To handle use case when user types in MO text box and without losing focus Save is clicked.
             * In this situation, the MOs have to be validated first. Since that is a server call, Save should be deferred until the server
             * call returns.
             **/
            beforemovalidate: this.beforeMOValidate,
            aftermovalidate: this.afterMOValidate
        };
        
        this.addEvents("cancel", "save");
        
        calms.question.details.grading.rubrics.Container.superclass.initComponent.call(this);
    },
    
    refreshActions: function() {
        var msgs = Messages.Question.rubrics,
            isEditMode = this.isEditMode(),
            
            reviewCheckBox = Ext.create({
                xtype: "checkbox",
                align: "left",
                checked: this.data.levelsOnReview,
                allowAdd: isEditMode,
                boxLabel: msgs.includeReview( this.data.levelsOnReview ? "" : msgs.includeFeedback() ),
                listeners: {
                    scope: this,
                    
                    afterrender: function(me) {
                        me.el.parent().addClass("rubrics-review-checkbox");
                    },
                    
                    check: function(me, checked) {
                        var boxLabelEl = me.wrap.down("label"),
                            boxLabel;
                        
                        if (!checked) {
                            this.expandFeedback();
                            boxLabel = Messages.Question.rubrics.includeReview( Messages.Question.rubrics.includeFeedback() );
                        }
                        else {
                            boxLabel = Messages.Question.rubrics.includeReview("");
                        }
                        
                        boxLabelEl.update(boxLabel);
                        
                        Ext.each(this.editRowContainers, function(item) {
                            item.fireEvent("feedbackoptional", item, checked);
                        });
                    }
                }
            }),
        
            headerActions = [
                reviewCheckBox,
                
                {
                    xtype: "box",
                    align: "left",
                    allowAdd: !isEditMode && this.data.levelsOnReview,
                    html: "<div class='rubrics-view-review'>" + msgs.includeReview("") + "</div>"
                },
                
                {
                    text: this.expandAllFeedback ? msgs.collapseAllFeedback() : msgs.expandAllFeedback(),
                    scope: this,
                    handler: function() {
                        this.toggleAllFeedback();
                        this.refreshActions();
                    }
                },
                
                {
                    text: msgs.addColumn(),
                    allowAdd: isEditMode,
                    scope: this,
                    handler: function() {
                        this.addColumn();
                    }
                }
            ];
            
        this.onReview = reviewCheckBox;
        this.setTitle( msgs.totalCredit(this.questionPoints) );
            
        this.setHeaderActions(headerActions);
    },
    
    createRubric: function() {
        
        this.viewContainer = Ext.create({
            xtype: "container",
            border: false,
            autoHeight: true,
            layout: "table",
            layoutConfig: {
                columns: this.columns,
                tableAttrs: {
                    style: {
                        "font-size": "9pt"
                    },
                    cellspacing: 5
                }
            },

            items: this.createViewItems()
        });
        
        this.editContainer = Ext.create({
            xtype: "form",
            border: false,
            autoHeight: true,

            items: this.createEditItems(),

            buttonAlign: "center",
            buttons: [
                {
                    cls: "x-btn-yellow",
                    text: Messages.Common.Save(),
                    scope: this,
                    handler: function() {
                        this.save(false);
                    }
                },

                {
                    text: Messages.Common.Apply(),
                    scope: this,
                    handler: function() {
                        this.save(true);
                    }
                },

                {
                    text: Messages.Common.Cancel(),
                    scope: this,
                    handler: function() {
                        this.fireEvent("cancel");
                    }
                }
            ]
        });
        
        this.cardContainer = Ext.create({
            xtype: "container",
            layout: "card",
            layoutConfig: {
                deferredRender: true
            },
            activeItem: 0,
            width: this.getRubricsWidth(),
            border: false,
            items: [
                this.viewContainer, this.editContainer
            ]
        });
        
        return this.cardContainer;
    },
    
    createViewItems: function() {
        var i, j, data, item,
            items = [],
            leftToRight = this.isLeftToRight(),
            topToBottom = this.isTopToBottom(),
            dim = RubricConstants.dimensions,
            x, y;
            
        for (i = 0; i < this.rows; i++) {
            
            for (j = 0; j < this.columns; j++) {
                
                if ( i == 0 && j == 0 ) {
                    item = Ext.create({
                        xtype: "box",
                        cellCls: "rubrics-view-base",
                        width: dim.reorderWidth - 15
                    });
                }
                
                else if ( i == 0 && j > 0 ) {
                    x = RubricConstants.getPosition(leftToRight, this.columns, j);
                    data = (this.data.levels || [])[x];
                    item = Ext.create({
                        xtype: "box",
                        cellCls: "rubrics-view-base",
                        width: dim.colWidth - 15,
                        tpl: Ext.ux.extml.templates.RubricColumnHeader,
                        data: data || {}
                    });
                }
                
                else if ( i > 0 && j == 0 ) {
                    y = RubricConstants.getPosition(topToBottom, this.rows, i);
                    data = ( this.data.criteria || [] )[y];
                    item = Ext.create({
                        xtype: "box",
                        cellCls: "rubrics-view-base",
                        width: dim.reorderWidth - 15,
                        tpl: Ext.ux.extml.templates.RubricRowHeader,
                        data: data || {}
                    });
                }
                
                else {
                    x = RubricConstants.getPosition(leftToRight, this.columns, j);
                    y = RubricConstants.getPosition(topToBottom, this.rows, i);
                    data = ( ( this.data.criteria || [] )[y] ) || {};
                    item = Ext.create({
                        xtype: "calms.question.details.grading.rubrics.CellView",
                        cellCls: "rubrics-view-base",
                        width: dim.colWidth - 15,
                        cell: ( data.choices || [] )[x] || {}
                    });
                }
                
                items.push(item);
            }         
        }
        
        return items;
    },
    
    createEditItems: function() {
        var i, y,
            dim = RubricConstants.dimensions,
            items = [],
            isFeedbackOptional = this.data.levelsOnReview;
            
        this.editRowContainers = [];
            
        for (i = 0; i < this.rows; i++) {
            
            y = RubricConstants.getPosition(this.isTopToBottom(), this.rows, i);
            
            this.editRowContainers[i] = Ext.create({
                xtype: "calms.question.details.grading.rubrics.RowContainer",
                height: i == 0 ? dim.reorderHeight : (isFeedbackOptional ? RubricConstants.getRowHeight() : RubricConstants.getFullRowHeight()),
                rowPosition: i,
                columns: this.columns,
                reorderWidth: dim.reorderWidth,
                questionId: this.questionId,
                questionPoints: this.questionPoints,
                topToBottom: this.isTopToBottom(),
                isFeedbackOptional: isFeedbackOptional,
                standards: this.data.levels || [],
                criteria: ( this.data.criteria || [] )[y],
                leftToRight: this.isLeftToRight()
            });
        }
        
        this.reorderCmp = this.editRowContainers[0].getComponent(0);
        
        items = items.concat(this.editRowContainers, [
            {
                xtype: "box",
                html: "<a href='javascript:;' class='add-row'>"+Messages.Question.rubrics.addCriterion()+"</a>",
                listeners: {
                    scope: this,
                    afterrender: function(me) {
                        var fn = function() {
                                this.addRow();
                            };
                        
                        me.mon(me.el, "click", fn, this, {
                            delegate: "a.add-row"
                        });
                    }
                }
            }
        ]);
        
        return items;
    },
    
    getRubricsWidth: function() {
        return RubricConstants.getRubricsWidth(this.columns);
    },
    
    isLeftToRight: function() {
        return Ext.isDefined(this.data.levelsOriginalOrder) ? this.data.levelsOriginalOrder : true;
    },
    
    isTopToBottom: function() {
        return Ext.isDefined(this.data.criteriaOriginalOrder) ? this.data.criteriaOriginalOrder : true;
    },
    
    expandFeedback: function() {
        Ext.each(this.editRowContainers, function(item) {
            item.expandRow();
        });
        
        this.expandAllFeedback = true;
    },
    
    toggleAllFeedback: function() {
        if (this.isDisplayMode()) {
            this.viewContainer.items.each(function(item) {
                if (this.expandAllFeedback) {
                    if (item.collapseFeedback) item.collapseFeedback();
                }
                else {
                    if (item.expandFeedback) item.expandFeedback();
                }
            }, this);
        }
        else {
            Ext.each(this.editRowContainers, function(item) {
                if (this.expandAllFeedback) {
                    item.collapseRow();
                }
                else {
                    item.expandRow();
                }
            }, this);
        }
        
        this.expandAllFeedback = !this.expandAllFeedback;
    },
    
    refreshPositions: function() {
        Ext.each(this.editRowContainers, function(rowContainer, index) {
            rowContainer.setRowPosition(index);
        });
    },
    
    addColumn: function(position) {
        var leftToRight = this.reorderCmp.getData().levelsOriginalOrder;
        
        if (this.columns == RubricConstants.maxColumns) {
            return;
        }
        
        if (!Ext.isDefined(position)) {
            position = leftToRight ? this.columns : 1;
        }
        
        Ext.invoke(this.editRowContainers, "addColumn", position);
        this.refreshPositions();
        this.columns = this.columns + 1;
        
        this.cardContainer.setWidth( this.getRubricsWidth() );
        this.doLayout();
    },
    
    removeColumn: function(position) {
        if (this.columns == RubricConstants.minColumns) {
            return;
        }
        
        Ext.invoke(this.editRowContainers, "removeColumn", position);
        this.refreshPositions();
        this.columns = this.columns - 1;
        
        this.cardContainer.setWidth( this.getRubricsWidth() );
        this.doLayout();
    },
    
    addRow: function(position) {
        var reorderData = this.reorderCmp.getData(),
            topToBottom = reorderData.criteriaOriginalOrder,
            leftToRight = reorderData.levelsOriginalOrder,
            dim = RubricConstants.dimensions,
            isFeedbackOptional = this.onReview.getValue(),
            rowContainer;
        
        if (this.rows == RubricConstants.maxRows) {
            return;
        }
        
        if (!Ext.isDefined(position)) {
            position = topToBottom ? this.rows : 1;
        }
        
        rowContainer = Ext.create({
            xtype: "calms.question.details.grading.rubrics.RowContainer",
            height: isFeedbackOptional ? RubricConstants.getRowHeight() : RubricConstants.getFullRowHeight(),
            rowPosition: position,
            columns: this.columns,
            questionId: this.questionId,
            reorderWidth: dim.reorderWidth,
            isFeedbackOptional: isFeedbackOptional,
            levelsOriginalOrder: this.data.levelsOriginalOrder,
            criteriaOriginalOrder: this.data.criteriaOriginalOrder,
            criteria: {},
            leftToRight: leftToRight
        });
        
        this.editRowContainers.splice(position, 0, rowContainer);
        this.editContainer.insert(position, rowContainer);
        this.refreshPositions();
        this.rows = this.rows + 1;
        
        this.doLayout();
    },
    
    removeRow: function(position) {
        if (this.rows == RubricConstants.minRows) {
            return;
        }
        
        this.editContainer.remove(this.editRowContainers[position]);
        this.editRowContainers.splice(position, 1);
        this.refreshPositions();
        this.rows = this.rows - 1;
        
        this.doLayout();
    },
    
    columnReorder: function(leftToRight) {
        Ext.invoke(this.editRowContainers, "columnReorder", leftToRight);
        this.refreshPositions();
    },
    
    rowReorder: function(topToBottom) {
        var map = RubricConstants.getReorderMap(this.editRowContainers.length),
            firstRow = this.editRowContainers.shift();
            
        this.editRowContainers.reverse();
        this.editRowContainers.unshift(firstRow);
        
        this.editContainer.items.reorder(map);
        /* This is so BAD. All layouts except for BoxLayout (and its derived classes hbox and vbox), do not re-render their child components
         * if they are re-arranged among themselves. All it does is checks if the child's parent el is same as the container's el in isValidParent().
         * Which would obviously return true, hence the child is not rendered.
         * To force re-render, update the parent's el. That will make isValidParent() to return false, and cause the child to render. */
        this.editContainer.update("");
        this.editContainer.doLayout();        
        
        this.refreshPositions();
    },
    
    distributePoints: function() {
        var rows = this.rows - 1,
            quotient = parseInt(this.questionPoints / rows),
            remainder = this.questionPoints - (quotient * rows);
        
        if (quotient < 1) {
            Ext.Msg.alert(Messages.Common.Warning(), Messages.Question.rubrics.moreRowsWarning());
            return;
        }
        
        Ext.each(this.editRowContainers, function(item, index) {
            if (index != 0) {
                var points = quotient + (remainder > 0 ? 1 : 0);
                item.setPoints(points);
                remainder--;
            }
        });
    },
    
    getData: function() {
        var rubrics = {
                title: this.data.title,
                id: this.data.id,
                levelsOnReview: this.onReview.getValue(),
                criteria: []
            };
        
        Ext.each(this.editRowContainers, function(item, index) {
            var data = item.getData();
            if (index == 0) {
                Ext.apply(rubrics, data);
            }
            else {
                rubrics.criteria.push(data);
            }
        });
        
        if (!rubrics.criteriaOriginalOrder) {
            rubrics.criteria.reverse();
        }
        
        return rubrics;
    },
    
    beginEdit: function() {
        this.expandAllFeedback = false;
        this.cardContainer.getLayout().setActiveItem(1);
        this.setEditMode();
        this.refreshActions();
        this.cardContainer.doLayout();
    },
                
    beforeMOValidate: function() {
        this.moValidationOn = true;
    },

    afterMOValidate: function(valid) {
        this.moValidationOn = false;

        if (this.deferSave) {
            if (valid) {
                this.save.apply(this, this.deferSave);
            }
            delete this.deferSave;
        }
    },
    
    save: function(apply) {
        if (!this.moValidationOn) {
            if (this.valid()) {
                this.fireEvent("save", this.getData(), apply);
            }
        }
        else {
            this.deferSave = [apply];
        }
    },
    
    valid: function() {
        var valid = true,
            msgs = [],
            totalPoints = 0;
        
        //Invoke valid on all rows.
        Ext.each(this.editRowContainers, function(item, index) {
            var validItem = item.valid();
            if (!validItem) {
                msgs = msgs.concat( item.getErrorMsgs() )
            }
            valid = valid && validItem;
            if (index != 0) {
                totalPoints = totalPoints + item.getHighestCellPoints();
            }
        });
        
        //Vaildate if sum of all points for highest column is same as question points.
        if (this.questionPoints != totalPoints) {
            valid = valid && false;
            msgs.push( Messages.Question.rubrics.error.questionPoints() );
        }
        
        msgs = Ext.unique(msgs);
        
        if (!valid && !Ext.isEmpty(msgs)) {
            Ext.Msg.calmsConfirm({
                title: Messages.Common.ValidationError(),
                msg: msgs.join("</br>"),
                buttons: Ext.Msg.OK,
                icon: Ext.MessageBox.WARNING
            });
        }
        
        return valid;
    }
    
});

Ext.reg("calms.question.details.grading.rubrics.Container", calms.question.details.grading.rubrics.Container);
