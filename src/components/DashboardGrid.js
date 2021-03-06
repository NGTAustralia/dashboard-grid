import React from 'react';

import R from 'ramda';
import Radium from 'radium';

import * as d3 from 'd3-dsv';
import * as fs from 'fs';

import {Responsive, WidthProvider} from 'react-grid-layout';
const ResponsiveReactGridLayout = WidthProvider(Responsive);

import PlotForm from '../components/PlotForm.react.js';

import Plotly from 'plotly.js';
import createPlotlyComponent from '../components/plotlyjs.react.js';
const PlotlyComponent = createPlotlyComponent(Plotly);

import ReactTable from 'react-table'

import '../css/normalize.css';
import '../css/skeleton.css';
import '../css/styles.css';
import '../css/react-table.css';

import mapJSON from '../../test_data/eb_ob_ggplot2_restyled.json';
import obDeathsJSON from '../../test_data/eb_ob_barchart.json';
import obDeathsCumulativeJSON from '../../test_data/eb_ob_line.json';
import csvJSON from '../../test_data/csv.json';

function dfltPlot( plotChoice ){

    var json;

    switch( plotChoice ){
        case 1:
            json = mapJSON; break;
        case 2: 
            json = obDeathsJSON; break;
        case 3:
            json = obDeathsCumulativeJSON; break;
        default:
            json = mapJSON; break;
    }

    return json;
};


function dfltTable(){
    
    var csvObj;
    var csvStr = csvJSON.csv;

    csvObj = d3.csvParse( csvStr );

    return csvObj;
}

(function() {
    var throttle = function(type, name, obj) {
        obj = obj || window;
        var running = false;
        var func = function() {
            if (running) { return; }
            running = true;
            requestAnimationFrame(function() {
                    obj.dispatchEvent(new CustomEvent(name));
                    running = false;
                });
        };
        obj.addEventListener(type, func);
    };

    /* init - you can init any event */
    throttle("resize", "optimizedResize");
})();

const cf = dfltTable();

class DashboardGrid extends React.Component{

	constructor(props) {
		super(props);        
	};

	static defaultProps = {
		className: "layout",
		rowHeight: 30,
		onLayoutChange: function() {},
		onRemoveItem: function() {},
		cols: {lg: 12, md: 12, sm: 12, xs: 6, xxs: 6},
        breakpoints: {lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}
	};

	state = {
		currentBreakpoint: 'lg',
		mounted: false,
		layouts: {lg: this.props.initialLayout},
        items: [
			{ x: 0, y:0, w: 6, h:15, i: '0', figure: dfltPlot(1) },
			{ x: 6, y:0, w: 6, h:15, i: '1', figure: dfltPlot(2) },      
			{ x: 0, y:0, w: 12, h:10, i: '2', figure: dfltPlot(3) },      
            { x: 0, y:0, w: 12, h:15, i: '3', dataTable: dfltTable() },      
		],
		newCounter: 0,
        showPlotForm: false,
        plotInEditMode: false,
        newPlot: { data: [], layout: {} },
        newTable: [],
        dataSelection: [],
	};

	componentDidMount = () => {
		this.setState({mounted: true});
        window.addEventListener("optimizedResize", this.updateDimensions);
	};

    updateDimensions = () => {
        this.setState({
                windowWidth: window.innerWidth
            });
    };

	onBreakpointChange = (breakpoint) => {
		this.setState({
			currentBreakpoint: breakpoint
		});
	};	    

	onLayoutChange = (layout ) => {		
		this.props.onLayoutChange(layout);
		this.setState({layout: layout});
	};

	onRemoveItem = (i) => {	
		console.log('removing', i);
		let valMatch = (obj) => i === obj['i'];
		this.setState({ items: R.reject( valMatch, this.state.items ) });
	};    

	drawPlotBox = (el) => {

		let config = { showLink: false, 
                       displayModeBar: true, 
                       mapboxAccessToken: 'pk.eyJ1IjoiamFja3AiLCJhIjoidGpzN0lXVSJ9.7YK6eRwUNFwd3ODZff6JvA' };

        let getColumnObj = ( firstRow ) => {
            let columnHeaders = Object.keys( firstRow );
            let columnKeyVals = columnHeaders.map( function(col){ return { Header: col, accessor: col } } );
            return columnKeyVals            
        }

		let i = el.i;
        let drawPlot = true;

        if( el.dataTable !== undefined ){
            drawPlot = false;
            let firstTableRow = el.dataTable[0];
            el.dataColumns = getColumnObj( firstTableRow );            
        }

        if( this.state.plotInEditMode !== false ){

            // Updating an existing plot or table

            if( this.state.plotInEditMode === i ){
                if( this.state.newPlot.data.length !== 0 ){
                    console.log('writing new plot', this.state);
                    el.figure.data = this.state.newPlot.data;
                    el.figure.layout = this.state.newPlot.layout;
                }
                else if( this.state.newTable.length !== 0 ){
                    drawPlot = false;
                    el.dataTable = this.state.newTable;
                    let firstTableRow = el.dataTable[0];
                    el.dataColumns = getColumnObj( firstTableRow );
                }
            }

        }

        var filterTrace = {};

        if( this.state.dataSelection.length > 0 ){
            if( el.figure !== undefined ){

                let xaxis = el.figure.layout.xaxis.title.toLowerCase();
                let yaxis = el.figure.layout.yaxis.title.toLowerCase();
                let xDim, yDim;

                if (xaxis == '' || xaxis == 'date') {
                    xDim = 'PLOTLY_DATE'
                } else if ( xaxis == 'lon' || xaxis == 'long' ) {
                    xDim = 'LONG'
                } 

                if (yaxis == 'lat') {
                    yDim = 'LAT';
                } else if ( yaxis.includes('death') ) {
                    yDim = 'OB_DEATH';
                }
                if( yaxis.includes('cumul') ){
                    yDim = 'CS_DEATH';
                }

                var ds = this.state.dataSelection;

                filterTrace = {  
                    x: ds.map( function( row ){ return row[xDim] } ),
                    y: ds.map( function( row ){ return row[yDim] } ),
                    marker: { color:'red' },
                    mode: 'markers',
                    name: 'Selection'
                }

            }
            else{
                el.dataTable = this.state.dataSelection;
                let firstTableRow = el.dataTable[0];
                el.dataColumns = getColumnObj( firstTableRow );                          
            }
        }

        if( drawPlot ){

            var dataClone = R.clone( el.figure.data );

            if( Object.keys(filterTrace).length > 0 ){ 
                dataClone.push( filterTrace ); 
            }

            el.figure.layout.dragmode = 'lasso';
            el.figure.layout.hovermode = 'closest';

   		    return (
  		        <div key={i} data-grid={el} >
                	<span style={[styles.cornerIcon, styles.iconLeft]} onClick={this.editPlot.bind(this, i)}>Edit </span>
                	<span style={[styles.cornerIcon, styles.iconRight]} onClick={this.onRemoveItem.bind(this, i)}> x</span>
                	<PlotlyComponent 
                        className="plotly-container" 
                        id={"plot"+i.toString()} 
                        style={styles.plotDivStyle}
                        onSelected={this.filterSelection.bind(this, i)}
		                data={dataClone} 
                        layout={el.figure.layout} 
                        config={config}/>
		        </div>		                        
        	)
        }else{
            return (
                <div key={i} data-grid={el} >
                    <span style={[styles.cornerIcon, styles.iconLeft]} onClick={this.editPlot.bind(this, i)}>Edit </span>
                    <span style={[styles.cornerIcon, styles.iconRight]} onClick={this.onRemoveItem.bind(this, i)}> x</span>
                    <ReactTable
                        data={el.dataTable}
                        columns={el.dataColumns}
                        showPagination={false}
                        showPageSizeOptions={false}
                    />
                </div>
            )            
        }
	};

    onAddItem = () => {
    	/*eslint no-console: 0*/
    	console.log('adding', 'n' + this.state.newCounter);
    	this.setState({
            // Add a new item. It must have a unique key!
		    items: this.state.items.concat({
				i: 'n' + this.state.newCounter,
			    x: this.state.items.length * 2 % (this.state.cols || 12),
			    y: Infinity, // puts it at the bottom
			    w: 4,
			    h: 10,
                figure: dfltPlot(), 
		    }),
	    	// Increment the counter to ensure key is always unique.
	    	newCounter: this.state.newCounter + 1
	    });
    };

    editPlot = (i) => {
        console.log('edit plot', i)
        this.setState( { plotInEditMode: i.toString(), showPlotForm: true } );
    };

    filterSelection = ( i, selectionArray ) => {

        let selectedXPoints = selectionArray.points.map( function ( ea ){ return ea.x } );


        let gridItems = this.state.items;
        let item = gridItems.filter(function( o ) { return o.i == i });
        let xt = item[0].figure.layout.xaxis.title;
        
        let filterColumn;

        if( [ '', 'Date' ].includes(xt) ){
            filterColumn = 'PLOTLY_DATE';
            selectedXPoints = selectedXPoints.map( function(d){
                    return new Date( d ).toISOString().split('T')[0].replace(/(^|-)0+/g, "$1");
            } );
        }

        else if( [ 'Long' ].includes(xt) ){
            filterColumn = 'LONG';
        }

        let matchingRows = cf.filter( function( row ){

                let val = row[filterColumn];

                if( isNaN(val) == false ){
                    val = Number( row[filterColumn] );
                }
                
                if( selectedXPoints.includes( val ) ){
                    return row;
                };
            } );

        this.setState({ dataSelection: matchingRows });

    };

    handleNewPlot = ( newPlotOrTableObj ) => {
        console.log( 'plotting new plot', newPlotOrTableObj );
        if( newPlotOrTableObj.hasOwnProperty('layout') ){  
            this.setState({ newPlot: newPlotOrTableObj, showPlotForm: false });
        }
        else{
            this.setState({ newTable: newPlotOrTableObj, showPlotForm: false });
        }
    };

    closePlotForm = () => {
        console.log('closing plot form');
        this.setState({
                    newPlot: { data: [], layout: {} },
                    newTable: [],
                    plotInEditMode: false, 
                    showPlotForm: false });
    };  

    render() {
    	
    	return (
            <div>
                <div style={styles.editPanel} >
			    <button onClick={this.onAddItem} className="button-primary">Add Plot</button>
            </div>

            <ResponsiveReactGridLayout className="layout"
                {...this.props}
			    onBreakpointChange={this.onBreakpointChange}
			    onLayoutChange={this.onLayoutChange}
			    onAddItem={this.onAddItem}
			    onRemoveItem={this.onRemoveItem}
			    // WidthProvider option
			    measureBeforeMount={true}
			    useCSSTransforms={this.state.mounted}>		                    		         	       
                {R.map(this.drawPlotBox, this.state.items)}
            </ResponsiveReactGridLayout>

            {(this.state.showPlotForm == true) ? 
            <PlotForm
                handleClose={this.closePlotForm}
                handleSubmit={this.handleNewPlot}  /> : 
             null}

	    	</div>
		)
    }
};


var styles = {
    cornerIcon: { position: 'absolute', top: '25px', cursor: 'pointer', zIndex: 99, right: '5px' },
    iconRight: { right: '2px' },
    iconLeft: { right: '20px' },
    plotDivStyle: { height: '100%', width: '100%' },
    editPanel: { position: 'absolute', top: '10px', left: '10px', zIndex: 99 }
}

DashboardGrid = Radium(DashboardGrid)

export default DashboardGrid;
