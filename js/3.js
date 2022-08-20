// 1.js
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute float a_select;\n' +
  'attribute mat4 a_transformMatrix;\n' +
  'uniform mat4 u_projMatrix;\n' +
  'uniform float u_pointSize;\n' +
  'uniform vec4 u_color;\n' +
  'uniform vec4 u_colorSelect;\n' +
  'varying vec4 v_color;\n' +
  'void main() {\n' +
  '  gl_Position = u_projMatrix * a_transformMatrix * a_Position;\n' +
  '  gl_PointSize = u_pointSize;\n' +
  '  if (a_select != 0.0)\n' +
  '    v_color = u_colorSelect;\n' +
  '  else\n' +
  '    v_color = u_color;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  'precision mediump float;\n' +
  'varying vec4 v_color;\n' +
  'void main() {\n' +
  '  gl_FragColor = v_color;\n' +
  '}\n';

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);

  var projMatrix = mat4.ortho(mat4.create(), 0, gl.drawingBufferWidth, 0, gl.drawingBufferHeight, 0, 1);

    // Pass the projection matrix to the vertex shader
  var u_projMatrix = gl.getUniformLocation(gl.program, 'u_projMatrix');
  if (!u_projMatrix) {
      console.log('Failed to get the storage location of u_projMatrix');
      return;
  }
  gl.uniformMatrix4fv(u_projMatrix, false, projMatrix);

  var countSplinePoints = document.getElementById("countSplinePoints");
  var leftBC = document.getElementById("leftBC");
  var rightBC = document.getElementById("rightBC");
  var uniformParam = document.getElementById("uniformParam");
  var distanceParam = document.getElementById("distanceParam");

  Data.init(gl, leftBC, rightBC, countSplinePoints, uniformParam, distanceParam);

  // Register function (event handler) to be called on a mouse press
  canvas.onclick = function(ev){ click(ev, canvas); };

  canvas.onmousemove = function (ev) { mousemove(ev, canvas); };

  canvas.onmousedown = function (ev) { mousedown(ev, canvas); };

  canvas.onmouseup = function (ev) { mouseup(ev, canvas); };

  var lineSpline = document.getElementById("chkLineSpline");
  var ctrPts = document.getElementById("chkCtrPts");
  var brokenLine = document.getElementById("chkBrokenLine");
  var visualizeSplineWithPoints = document.getElementById("chkVisualizeWithPoints");
  var visualizeSplineWithLines = document.getElementById("chkVisualizeWithLine");

  lineSpline.onclick = function () { Data.plotMode(1); };
  countSplinePoints.onchange = function () { Data.plotMode(2); };
  leftBC.onchange = function () { Data.plotMode(2); };
  rightBC.onchange = function () { Data.plotMode(2); };
  uniformParam.onclick = function () { Data.plotMode(2); };
  distanceParam.onclick = function () { Data.plotMode(2); };
  ctrPts.onclick = function () { Data.plotMode(6); };
  brokenLine.onclick = function () { Data.plotMode(3); };
  visualizeSplineWithPoints.onclick = function () { Data.plotMode(4); };
  visualizeSplineWithLines.onclick = function () { Data.plotMode(5); };

  // Specify the color for clearing <canvas>
  gl.clearColor(0.8, 0.8, 0.8, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function Point(x,y) {
    this.select = false;
    // ƒŒ¡¿¬»“‹ œ¿–¿Ã≈“–»◊≈— ”ﬁ  ŒŒ–ƒ»Õ¿“” t
    this.t = 0;
    this.x = x;
    this.y = y;
    this.transformMatrix = mat4.create();
    this.setRect();
}

Point.prototype = {
    setPoint: function (x, y) {
        this.x = x;
        this.y = y;
        this.setRect();
    },
    setRect: function () {
        this.left = this.x - 5;
        this.right = this.x + 5;
        this.bottom = this.y - 5;
        this.up = this.y + 5;
    },
    ptInRect(x, y) {
        var inX = this.left <= x && x <= this.right;
        var inY = this.bottom <= y && y <= this.up;
        return inX && inY;
    },
    setTransformMatrix: function (T) {
        this.transformMatrix = T;
    }
}

var Data = {
    pointsCtr: [],
    mPointsCtr: [],
    pointsVectorCtr: [],
    pointsVectorTipCtr: [],
    pointsSpline: [],
    count: 0,
    countAttribData: 2 + 1 + 16, //x,y,sel,transformMatrix
    verticesCtr: {},
    verticesVectorCtr: {},
    verticesVectorTipCtr: {},
    verticesSpline: {},
    FSIZE: 0,
    gl: null,
    vertexBufferCtr: null,
    vertexBufferVectorCtr: null,
    vertexBufferVectorTipCtr: null,
    vertexBufferSpline: null,
    a_Position: -1,
    a_select: -1,
    a_transformMatrix: -1,
    u_color: null,
    u_colorSelect: null,
    u_pointSize: null,
    movePoint: false,
    moveVector: false,
    iMove: -1,
    imMove: -1,
    OldPt: null,
    OldPtm: null,
    tPt: null,
    leftButtonDown: false,
    drawCtrPts: true,
    drawBrokenLine: false,
    drawNaturalCubeSpline: false,
    leftBC: null,
    rightBC: null,
    isSelectedLeftCtrlPoint: false,
    isSelectedRightCtrlPoint: false,
    visualizeSplineWithPoints: true,
    visualizeSplineWithLine: false,
    countSplinePoints: null,
    uniformParam: null,
    distanceParam: null,
    init: function (gl, leftBC, rightBC, countSplinePoints, uniformParam, distanceParam) {
        this.gl = gl;
        // Create a buffer object
        this.vertexBufferCtr = this.gl.createBuffer();
        if (!this.vertexBufferCtr) {
            console.log('Failed to create the buffer object for control points');
            return -1;
        }
        this.vertexBufferVectorCtr = this.gl.createBuffer();
        if (!this.vertexBufferVectorCtr) {
            console.log('Failed to create the buffer object for control points');
            return -1;
        }
        this.vertexBufferVectorTipCtr = this.gl.createBuffer();
        if (!this.vertexBufferVectorTipCtr) {
            console.log('Failed to create the buffer object for control points');
            return -1;
        }
        this.vertexBufferSpline = this.gl.createBuffer();
        if (!this.vertexBufferSpline) {
            console.log('Failed to create the buffer object for spline points');
            return -1;
        }

        this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
        if (this.a_Position < 0) {
            console.log('Failed to get the storage location of a_Position');
            return -1;
        }

        this.a_select = this.gl.getAttribLocation(this.gl.program, 'a_select');
        if (this.a_select < 0) {
            console.log('Failed to get the storage location of a_select');
            return -1;
        }

        this.a_transformMatrix = this.gl.getAttribLocation(this.gl.program, 'a_transformMatrix');
        if (this.a_transformMatrix < 0) {
            console.log('Failed to get the storage location of a_transformMatrix');
            return -1;
        }

        // Get the storage location of u_color
        this.u_color = this.gl.getUniformLocation(this.gl.program, 'u_color');
        if (!this.u_color) {
            console.log('Failed to get u_color variable');
            return;
        }

        // Get the storage location of u_colorSelect
        this.u_colorSelect = gl.getUniformLocation(this.gl.program, 'u_colorSelect');
        if (!this.u_colorSelect) {
            console.log('Failed to get u_colorSelect variable');
            return;
        }

        // Get the storage location of u_pointSize
        this.u_pointSize = gl.getUniformLocation(this.gl.program, 'u_pointSize');
        if (!this.u_pointSize) {
            console.log('Failed to get u_pointSize variable');
            return;
        }

        this.countSplinePoints = countSplinePoints;
        this.leftBC = leftBC;
        this.rightBC = rightBC;
        this.uniformParam = uniformParam;
        this.distanceParam = distanceParam;

        this.OldPt = new Point(0, 0);
        this.OldPtm = new Point(0, 0);
        this.tPt = new Point(0, 0);
    },
    setLeftButtonDown: function (value) {
        this.leftButtonDown = value;
    },
    add_coords: function (x, y) {
        var pt = new Point(x, y);
        var ptm;

        this.pointsCtr.push(pt);

        ptm = new Point(x + 50, y);
        this.mPointsCtr.push(ptm);
        this.setVector(pt.x, pt.y, ptm.x, ptm.y, -1);

        this.count += this.countAttribData;
        this.add_vertices();
    },
    setVector: function (x1, y1, x2, y2, i) {
        var pt;
        var ptm;

        var rBase;
        var length;

        var ux, uy, vx, vy, norm;
        var translateMatrix;
        var rotateMatrix;
        var transformMatrix;

        var lengthMax;

        if (i == -1) //create mode
        {
            pt = new Point(x1, y1);
            ptm = new Point(x2, y2);

            this.pointsVectorCtr.push(pt);
            this.pointsVectorCtr.push(ptm);
        }
        else //update mode
        {
            this.pointsVectorCtr[2 * i].setPoint(x1, y1);
            this.pointsVectorCtr[2 * i + 1].setPoint(x2, y2);
        }

        lengthMax = 90;

        length = lengthMax * 0.3;
        rBase = length * 0.25;

        vx = x2 - x1;
        vy = y2 - y1;

        norm = Math.sqrt(vx * vx + vy * vy);

        vx /= norm;
        vy /= norm;

        ux = -vy;
        uy = vx;

        rotateMatrix = mat4.fromValues(ux, vx, 0.0, 0.0,
            uy, vy, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0)

        translateMatrix = mat4.fromTranslation(mat4.create(), [x2, y2, 0.0]);
        transformMatrix = mat4.mul(mat4.create(), translateMatrix, rotateMatrix);

        if (i == -1) //create mode
        {
            pt = new Point(0, 0);
            pt.setTransformMatrix(transformMatrix);
            this.pointsVectorTipCtr.push(pt);
            pt = new Point(-rBase, -length);
            pt.setTransformMatrix(transformMatrix);
            this.pointsVectorTipCtr.push(pt);
            pt = new Point(rBase, -length);
            pt.setTransformMatrix(transformMatrix);
            this.pointsVectorTipCtr.push(pt);
        }
        else //update mode
        {
            this.pointsVectorTipCtr[3 * i].setPoint(0.0, 0.0);
            this.pointsVectorTipCtr[3 * i].setTransformMatrix(transformMatrix);
            this.pointsVectorTipCtr[3 * i + 1].setPoint(-rBase, -length);
            this.pointsVectorTipCtr[3 * i + 1].setTransformMatrix(transformMatrix);
            this.pointsVectorTipCtr[3 * i + 2].setPoint(rBase, -length);
            this.pointsVectorTipCtr[3 * i + 2].setTransformMatrix(transformMatrix);
        }

        if (i != -1) //update mode
            this.updateVerticesVectorCtr(i);
    },
    setSelectVector: function (select, i) {
        this.pointsVectorCtr[2 * i].select = select;
        this.pointsVectorCtr[2 * i + 1].select = select;
        this.pointsVectorTipCtr[3 * i].select = select;
        this.pointsVectorTipCtr[3 * i + 1].select = select;
        this.pointsVectorTipCtr[3 * i + 2].select = select;

        this.updateVerticesVectorCtr(i);
    },
    updateVerticesVectorCtr: function (i) {
        this.verticesVectorCtr[2 * i * this.countAttribData] = this.pointsVectorCtr[2 * i].x;
        this.verticesVectorCtr[2 * i * this.countAttribData + 1] = this.pointsVectorCtr[2 * i].y;
        this.verticesVectorCtr[2 * i * this.countAttribData + 2] = this.pointsVectorCtr[2 * i].select;
        this.verticesVectorCtr[(2 * i + 1) * this.countAttribData] = this.pointsVectorCtr[2 * i + 1].x;
        this.verticesVectorCtr[(2 * i + 1) * this.countAttribData + 1] = this.pointsVectorCtr[2 * i + 1].y;
        this.verticesVectorCtr[(2 * i + 1) * this.countAttribData + 2] = this.pointsVectorCtr[2 * i + 1].select;


        this.verticesVectorTipCtr[3 * i * this.countAttribData] = this.pointsVectorTipCtr[3 * i].x;
        this.verticesVectorTipCtr[3 * i * this.countAttribData + 1] = this.pointsVectorTipCtr[3 * i].y;
        this.verticesVectorTipCtr[3 * i * this.countAttribData + 2] = this.pointsVectorTipCtr[3 * i].select;
        this.verticesVectorTipCtr[(3 * i + 1) * this.countAttribData] = this.pointsVectorTipCtr[3 * i + 1].x;
        this.verticesVectorTipCtr[(3 * i + 1) * this.countAttribData + 1] = this.pointsVectorTipCtr[3 * i + 1].y;
        this.verticesVectorTipCtr[(3 * i + 1) * this.countAttribData + 2] = this.pointsVectorTipCtr[3 * i + 1].select;
        this.verticesVectorTipCtr[(3 * i + 2) * this.countAttribData] = this.pointsVectorTipCtr[3 * i + 2].x;
        this.verticesVectorTipCtr[(3 * i + 2) * this.countAttribData + 1] = this.pointsVectorTipCtr[3 * i + 2].y;
        this.verticesVectorTipCtr[(3 * i + 2) * this.countAttribData + 2] = this.pointsVectorTipCtr[3 * i + 2].select;

        for (var j = 0; j < 16; j++) {
            this.verticesVectorTipCtr[3 * i * this.countAttribData + 3 + j] = this.pointsVectorTipCtr[3 * i].transformMatrix[j];
            this.verticesVectorTipCtr[(3 * i + 1) * this.countAttribData + 3 + j] = this.pointsVectorTipCtr[3 * i + 1].transformMatrix[j];
            this.verticesVectorTipCtr[(3 * i + 2) * this.countAttribData + 3 + j] = this.pointsVectorTipCtr[3 * i + 2].transformMatrix[j];
        }
    },
    mousemoveHandler: function (x, y) {
        if (this.leftButtonDown) {
            if (this.movePoint) {
                this.pointsCtr[this.iMove].setPoint(x, y);

                this.verticesCtr[this.iMove * this.countAttribData] = this.pointsCtr[this.iMove].x;
                this.verticesCtr[this.iMove * this.countAttribData + 1] = this.pointsCtr[this.iMove].y;

                this.tPt.setPoint(this.pointsCtr[this.iMove].x - this.OldPt.x, this.pointsCtr[this.iMove].y - this.OldPt.y);

                this.mPointsCtr[this.iMove].setPoint(this.OldPtm.x + this.tPt.x, this.OldPtm.y + this.tPt.y);

                this.setVector(this.pointsCtr[this.iMove].x, this.pointsCtr[this.iMove].y, this.mPointsCtr[this.iMove].x, this.mPointsCtr[this.iMove].y, this.iMove);
            }
            else
                if (this.moveVector) {
                    if (((this.leftBC.value == 1) || (this.leftBC.value == 2)) &&
                        (this.count != 0) && (this.mPointsCtr[0].select == true))
                    {
                        this.mPointsCtr[0].setPoint(x, y);

                        this.setVector(this.pointsCtr[0].x, this.pointsCtr[0].y, this.mPointsCtr[0].x, this.mPointsCtr[0].y, 0);
                    }

                    if (((this.rightBC.value == 1) || (this.rightBC.value == 2)) &&
                        (this.count != 0) &&
                        (this.mPointsCtr[this.mPointsCtr.length-1].select == true)) {
                        this.mPointsCtr[this.mPointsCtr.length - 1].setPoint(x, y);

                        this.setVector(this.pointsCtr[this.pointsCtr.length - 1].x, this.pointsCtr[this.pointsCtr.length - 1].y,
                            this.mPointsCtr[this.mPointsCtr.length - 1].x, this.mPointsCtr[this.mPointsCtr.length - 1].y,
                            this.mPointsCtr.length - 1);
                    }
                }

            if (this.movePoint || this.moveVector) {
                this.setVertexBuffersAndDraw();

                if (this.drawNaturalCubeSpline)
                    this.calculateNaturalCubeSpline();
            }
        }
        else {
            for (var i = 0; i < this.pointsCtr.length; i++) {
                this.pointsCtr[i].select = false;

                if (this.pointsCtr[i].ptInRect(x, y))
                    this.pointsCtr[i].select = true;

                this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;
            }

            this.isSelectedLeftCtrlPoint = false;
            this.isSelectedRightCtrlPoint = false;
            if (this.count != 0)
            {
                if (this.pointsCtr[0].select)
                    this.isSelectedLeftCtrlPoint = true;

                if (this.pointsCtr[this.pointsCtr.length - 1].select)
                    this.isSelectedRightCtrlPoint = true;
            }

            if (((this.leftBC.value == 1) || (this.leftBC.value == 2)) && (this.count != 0))
            {
                this.mPointsCtr[0].select = false;

                if (this.mPointsCtr[0].ptInRect(x, y))
                    this.mPointsCtr[0].select = true;

                this.setSelectVector(this.mPointsCtr[0].select, 0);

            }

            if (((this.rightBC.value == 1) || (this.rightBC.value == 2)) && (this.count != 0))
            {
                this.mPointsCtr[this.mPointsCtr.length-1].select = false;

                if (this.mPointsCtr[this.mPointsCtr.length-1].ptInRect(x, y))
                    this.mPointsCtr[this.mPointsCtr.length-1].select = true;

                this.setSelectVector(
                    this.mPointsCtr[this.mPointsCtr.length-1].select, this.mPointsCtr.length-1);
            }

            this.setVertexBuffersAndDraw();

        }
    },
    mousedownHandler: function (button, x, y) {
        var i;

        if (button == 0) { //left button
            this.movePoint = false;

            for (i = 0; i < this.pointsCtr.length; i++) {
                if (this.pointsCtr[i].select == true) {
                    this.movePoint = true;
                    this.iMove = i;
                }
            }

            if (this.isSelectedLeftCtrlPoint)
            {
                this.OldPt.setPoint(this.pointsCtr[0].x, this.pointsCtr[0].y);
                this.OldPtm.setPoint(this.mPointsCtr[0].x, this.mPointsCtr[0].y);
            }


            if (this.isSelectedRightCtrlPoint)
            {
                this.OldPt.setPoint(
                    this.pointsCtr[this.pointsCtr.length - 1].x, this.pointsCtr[this.pointsCtr.length - 1].y);
                this.OldPtm.setPoint(
                    this.mPointsCtr[this.mPointsCtr.length - 1].x, this.mPointsCtr[this.mPointsCtr.length - 1].y);
            }

            this.moveVector = false;

            if (((this.leftBC.value == 1) || (this.leftBC.value == 2) ||
                 (this.rightBC.value == 1) || (this.rightBC.value == 2))
                && (this.count != 0) &&
                ((this.mPointsCtr[0].select == true) || (this.mPointsCtr[this.mPointsCtr.length-1].select == true)))
                    this.moveVector = true;

            this.setLeftButtonDown(true);
        }
    },
    mouseupHandler: function (button, x, y) {
        if (button == 0) //left button
            this.setLeftButtonDown(false);
    },
    clickHandler: function (x, y) {
        if (!this.movePoint && !this.moveVector) {
            this.add_coords(x, y);
            if (this.drawNaturalCubeSpline)
                this.calculateNaturalCubeSpline();
            this.setVertexBuffersAndDraw();
        }
    },
    clear: function () {
        this.count = 0;
    },
    add_vertices: function () {
        var i;

        this.verticesCtr = new Float32Array(this.pointsCtr.length * this.countAttribData);
        for (i = 0; i < this.pointsCtr.length; i++) {
            this.verticesCtr[i * this.countAttribData] = this.pointsCtr[i].x;
            this.verticesCtr[i * this.countAttribData + 1] = this.pointsCtr[i].y;
            this.verticesCtr[i * this.countAttribData + 2] = this.pointsCtr[i].select;
            for (var j = 0; j < 16; j++)
                this.verticesCtr[i * this.countAttribData + 3 + j] = this.pointsCtr[i].transformMatrix[j];
        }

        this.verticesVectorCtr = new Float32Array(2 * this.pointsCtr.length * this.countAttribData);
        for (i = 0; i < this.pointsCtr.length; i++)
            for (var j = 0; j < 16; j++) {
                this.verticesVectorCtr[2 * i * this.countAttribData + 3 + j] = this.pointsVectorCtr[2 * i].transformMatrix[j];
                this.verticesVectorCtr[(2 * i + 1) * this.countAttribData + 3 + j] = this.pointsVectorCtr[2 * i + 1].transformMatrix[j];
            }

        this.verticesVectorTipCtr = new Float32Array(3 * this.pointsCtr.length * this.countAttribData);
        for (i = 0; i < this.pointsCtr.length; i++) {
            this.updateVerticesVectorCtr(i);
        }

        this.FSIZE = this.verticesCtr.BYTES_PER_ELEMENT;
    },
    setVertexBuffersAndDraw: function () {
        if (this.count == 0)
            return;

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCtr);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesCtr, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Assign the buffer object to a_select variable
        this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 2);
        // Enable the assignment to a_select variable
        this.gl.enableVertexAttribArray(this.a_select);
        // Assign the buffer object to a_transformMatrix variable
        this.gl.vertexAttribPointer(this.a_transformMatrix, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 3);
        this.gl.vertexAttribPointer(this.a_transformMatrix + 1, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (4 + 3));
        this.gl.vertexAttribPointer(this.a_transformMatrix + 2, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (8 + 3));
        this.gl.vertexAttribPointer(this.a_transformMatrix + 3, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (12 + 3));
        // Enable the assignment to a_transformMatrix variable
        this.gl.enableVertexAttribArray(this.a_transformMatrix);
        this.gl.enableVertexAttribArray(this.a_transformMatrix + 1);
        this.gl.enableVertexAttribArray(this.a_transformMatrix + 2);
        this.gl.enableVertexAttribArray(this.a_transformMatrix + 3);

        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        if (this.drawCtrPts) {
            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 10.0);
            // Draw
            this.gl.drawArrays(this.gl.POINTS, 0, this.count / this.countAttribData);
        }
        if (this.drawBrokenLine) {
            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.0, 0.0, 0.0, 1.0);

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.count / this.countAttribData);
        }

        if (this.drawCtrPts) {
            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVectorCtr);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVectorCtr, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Assign the buffer object to a_select variable
            this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 2);
            // Enable the assignment to a_select variable
            this.gl.enableVertexAttribArray(this.a_select);
            // Assign the buffer object to a_transformMatrix variable
            this.gl.vertexAttribPointer(this.a_transformMatrix, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 3);
            this.gl.vertexAttribPointer(this.a_transformMatrix + 1, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (4 + 3));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 2, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (8 + 3));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 3, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (12 + 3));
            // Enable the assignment to a_transformMatrix variable
            this.gl.enableVertexAttribArray(this.a_transformMatrix);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 1);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 2);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 3);

            if ((this.leftBC.value == 1) || (this.leftBC.value == 2))
                this.gl.drawArrays(this.gl.LINES, 0, 2);

            if ((this.rightBC.value == 1) || (this.rightBC.value == 2))
                this.gl.drawArrays(this.gl.LINES, 2 * this.count / this.countAttribData-2, 2);


            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVectorTipCtr);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVectorTipCtr, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Assign the buffer object to a_select variable
            this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 2);
            // Enable the assignment to a_select variable
            this.gl.enableVertexAttribArray(this.a_select);
            // Assign the buffer object to a_transformMatrix variable
            this.gl.vertexAttribPointer(this.a_transformMatrix, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 3);
            this.gl.vertexAttribPointer(this.a_transformMatrix + 1, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (4 + 3));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 2, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (8 + 3));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 3, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (12 + 3));
            // Enable the assignment to a_transformMatrix variable
            this.gl.enableVertexAttribArray(this.a_transformMatrix);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 1);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 2);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 3);

            if ((this.leftBC.value == 1) || (this.leftBC.value == 2))
                this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

            if ((this.rightBC.value == 1) || (this.rightBC.value == 2))
                this.gl.drawArrays(this.gl.TRIANGLES, 3 * this.count / this.countAttribData - 3, 3);
        }

        if (this.drawNaturalCubeSpline) {
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferSpline);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesSpline, this.gl.DYNAMIC_DRAW);
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 2, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);
            // Assign the buffer object to a_transformMatrix variable
            this.gl.vertexAttribPointer(this.a_transformMatrix, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 3);
            this.gl.vertexAttribPointer(this.a_transformMatrix + 1, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (4 + 3));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 2, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (8 + 3));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 3, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (12 + 3));
            // Enable the assignment to a_transformMatrix variable
            this.gl.enableVertexAttribArray(this.a_transformMatrix);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 1);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 2);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 3);

            this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 7.0);

            if (this.visualizeSplineWithPoints)
                this.gl.drawArrays(this.gl.POINTS, 0, this.pointsSpline.length);

            if (this.visualizeSplineWithLine)
                this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsSpline.length);

        }
    },
    plotMode: function (selOption) {
        switch (selOption) {
            case 1:
                this.drawNaturalCubeSpline = !this.drawNaturalCubeSpline;
                if (this.drawNaturalCubeSpline) {
                    this.calculateNaturalCubeSpline();
                }
                break;
            case 2:
                if (this.drawNaturalCubeSpline) {
                    this.calculateNaturalCubeSpline();
                }
                break;
            case 3:
                this.drawBrokenLine = !this.drawBrokenLine;
                break;
            case 4:
                this.visualizeSplineWithPoints = !this.visualizeSplineWithPoints;
                break;
            case 5:
                this.visualizeSplineWithLine = !this.visualizeSplineWithLine;
                break;
            case 6:
                this.drawCtrPts = !this.drawCtrPts;
                break;
        }
        this.setVertexBuffersAndDraw();
    },
    calculateNaturalCubeSpline: function () {
        var i, j;
        var pt;
        var x, y;
        var m0;//
        var mN;
        var sum=0;
        // ‡Ò˜ÂÚ ÍÓÓ‰ËÌ‡Ú ‚ÂÍÚÓÓ‚ ÔÂ‚˚ı ËÎË ‚ÚÓ˚ı ÔÓËÁ‚Ó‰Ì˚ı

        if ((this.leftBC.value == 1) || (this.leftBC.value == 2)) {
            x = this.mPointsCtr[0].x - this.pointsCtr[0].x;
            y = this.mPointsCtr[0].y - this.pointsCtr[0].y;

            pt = new Point(x, y);

            m0 = pt;
        }

        if ((this.rightBC.value == 1) || (this.rightBC.value == 2)) {
            x = this.mPointsCtr[this.mPointsCtr.length - 1].x - this.pointsCtr[this.pointsCtr.length - 1].x;
            y = this.mPointsCtr[this.mPointsCtr.length - 1].y - this.pointsCtr[this.pointsCtr.length - 1].y;

            pt = new Point(x, y);

            mN = pt;
        }
         console.log(m0.x);
         console.log(m0.y);
         console.log(mN.x);
         console.log(mN.y);
        // –¿——◊»“¿“‹ «Õ¿◊≈Õ»≈ œ¿–¿Ã≈“–»◊≈— »’  ŒŒ–ƒ»Õ¿“  ŒÕ“–ŒÀ‹Õ€’ “Œ◊≈ //////////////////////////////////////////////Í‡Í ‚ 3
	this.pointsCtr[0].t=0;
	for (i = 1; i < this.pointsCtr.length;i++)
	{
        if (this.uniformParam.checked)
            this.pointsCtr[i].t = this.pointsCtr[i-1].t + 1;
        if (this.distanceParam.checked)
		{
            this.pointsCtr[i].t = this.pointsCtr[i - 1].t + Math.sqrt(Math.pow(this.pointsCtr[i].x - this.pointsCtr[i - 1].x, 2) + Math.pow(this.pointsCtr[i].y - this.pointsCtr[i - 1].y,2));
			sum=sum+Math.pow(this.pointsCtr[i].t,2);
		}
	}
	
	if (this.distanceParam.checked)
	{
		for (i = 1; i < this.pointsCtr.length;i++)
		{
			this.pointsCtr[i].t = this.pointsCtr[i].t/(Math.sqrt(sum));
		}
	}
        //if (this.uniformParam.checked)
        //this.pointsCtr[i].t = ;
        //if (this.distanceParam.checked)
        //this.pointsCtr[i].t = ;

        var N = this.countSplinePoints.value;
        this.pointsSpline = new Array(N);

       
       var LEN = this.pointsCtr.length-1;
        // –¿—◊≈“  ŒŒ–ƒ»Õ¿“ “Œ◊ » —œÀ¿…Õ¿
        var i=0;
       var t=this.pointsCtr[0].t;
        var dt = (this.pointsCtr[this.pointsCtr.length-1].t-this.pointsCtr[0].t)/N;//¯‡„ ÔÓ Ú 
        var h =[];
        var a= [];
        var b= [];
        var c =[];
        var d =[];
        var dy=[];
        ///////////////////////////////////«¿œŒÀÕ≈Õ»≈ Ã¿——»¬Œ¬ ƒÀﬂ œ–Œ√ŒÕ »/////////////////////////////\
       // var a =b=d=c= [];
        h[0]=this.pointsCtr[1].t-this.pointsCtr[0].t;
        h[LEN-1]=this.pointsCtr[LEN].t-this.pointsCtr[LEN-1].t;
        b[0]=2*h[0];
        d[0]=6*((this.pointsCtr[1].x-this.pointsCtr[0].x)/h[0]-m0.x);
        dy[0]=6*((this.pointsCtr[1].y-this.pointsCtr[0].y)/h[0]-m0.y);

        d[LEN]=6*(mN.x-((this.pointsCtr[LEN].x-this.pointsCtr[LEN-1].x)/h[LEN-1]));
        dy[LEN]=6*(mN.y-((this.pointsCtr[LEN].y-this.pointsCtr[LEN-1].y)/h[LEN-1]));

        a[LEN]=h[LEN-1];
        b[LEN]=2*h[LEN-1];
        for (i=0;i<LEN;i++)
       
          
        {
            h[i]=this.pointsCtr[i+1].t-this.pointsCtr[i].t;
            if(i != 0 )
            {
                a[i]=h[i-1];
                b[i]=2*(h[i-1]+h[i]);
             }
            
            c[i]=h[i];
            if ((i!=0)){
            d[i]=6*(((this.pointsCtr[i+1].x-this.pointsCtr[i].x)/h[i])-((this.pointsCtr[i].x-this.pointsCtr[i-1].x)/h[i-1]));
            dy[i]=6*(((this.pointsCtr[i+1].y-this.pointsCtr[i].y)/h[i])-((this.pointsCtr[i].y-this.pointsCtr[i-1].y)/h[i-1]));
            }
        }
        //////////////////////////œÓ„ÓÌÍ‡////////////////////////////////
        var alf=[];
        var bet=[];
        var betY=[];
        var gam=[];
        var i =0;/////////œˇÏÓÈ ıÓ‰
        gam[0]=b[0];
        alf[0]=-c[0]/gam[0];
        bet[0]=d[0]/gam[0];
         betY[0]=dy[0]/gam[0];
        for (i=1;i<LEN;i++)
        {
            gam[i]=b[i]+a[i]*alf[i-1];
            alf[i]=-c[i]/gam[i];
            bet[i]=(d[i]-a[i]*bet[i-1])/gam[i];
            betY[i]=(dy[i]-a[i]*betY[i-1])/gam[i];
        }
        i=LEN;
        gam[i]=b[i]+a[i]*alf[i-1];
        bet[i]=(d[i]-a[i]*bet[i-1])/gam[i];
        betY[i]=(dy[i]-a[i]*betY[i-1])/gam[i];
        var Mx=[];
        var My=[];
        Mx[LEN]=bet[LEN];///////////////////////////Œ·‡ÚÌ˚È
         My[LEN]=betY[LEN];
        for (var i=LEN-1;i!=-1;i--)
        {
             Mx[i]=alf[i]*Mx[i+1]+bet[i];
             My[i]=alf[i]*My[i+1]+betY[i];
        }
        var j=0;
        var t=this.pointsCtr[0].t;
            var  DELTA=0.01;
        var prx1=0,pry1=0,prx2=0,pry2=0,rad=0;
        for (var i = 0; i < this.pointsCtr.length-1;i++)
	{
		while (t <= this.pointsCtr[i+1].t)
		{
                x=Mx[i]*((this.pointsCtr[i+1].t-t)**3)/(6*h[i]);
                x=x+Mx[i+1]*((t-this.pointsCtr[i].t)**3)/(6*h[i]);
                x=x+(this.pointsCtr[i].x-Mx[i]*((h[i])**2)/6)*(this.pointsCtr[i+1].t-t)/h[i];
                x=x+(this.pointsCtr[i+1].x-Mx[i+1]*((h[i])**2)/6)*(t-this.pointsCtr[i].t)/h[i];
                y=My[i]*((this.pointsCtr[i+1].t-t)**3)/(6*h[i]);
                y=y+My[i+1]*((t-this.pointsCtr[i].t)**3)/(6*h[i]);
                y=y+(this.pointsCtr[i].y-My[i]*((h[i])**2)/6)*(this.pointsCtr[i+1].t-t)/h[i];
                y=y+(this.pointsCtr[i+1].y-My[i+1]*((h[i])**2)/6)*(t-this.pointsCtr[i].t)/h[i];
                  //////////////////////////////////////œÓËÁ‚Ó‰Ì˚Â//////////////////////////////////////////////////////////////////
                prx1=-Mx[i]*((this.pointsCtr[i+1].t-t)**2)/(2*h[i])+Mx[i+1]*((t-this.pointsCtr[i].t)**2)/(2*h[i])-(this.pointsCtr[i].x/h[i]-Mx[i]*h[i]/6)+(this.pointsCtr[i+1].x/h[i]-Mx[i+1]*h[i]/6);
                pry1=-My[i]*((this.pointsCtr[i+1].t-t)**2)/(2*h[i])+My[i+1]*((t-this.pointsCtr[i].t)**2)/(2*h[i])-(this.pointsCtr[i].y/h[i]-My[i]*h[i]/6)+(this.pointsCtr[i+1].y/h[i]-My[i+1]*h[i]/6);
                prx2=Mx[i]*(this.pointsCtr[i+1].t-t)/h[i]+Mx[i+1]*(t-this.pointsCtr[i].t)/h[i];
                pry2=My[i]*(this.pointsCtr[i+1].t-t)/h[i]+My[i+1]*(t-this.pointsCtr[i].t)/h[i];
                 rad=((prx1)**2+(pry1)**2)**(3/2)/((prx1*pry2)-(prx2*pry1));
                rad=Math.abs(rad);
               
            dt=2*((DELTA*(2*rad-DELTA))**(1/2))/((prx1**2+pry1**2)**(1/2));
                pt = new Point(x, y);
                this.pointsSpline[j]=pt;
                t+=dt;
                j++;
        }
     }

//      //          pt = new Point(x, y);
//        //        this.pointsSpline[j]=pt;
//                t+=dt;
//                j++;
//            }
//        }
          console.log(a);
            console.log(b);
            console.log(c);
              console.log(d);
                console.log(h);
                console.log(Mx);
                console.log(My);
                console.log(bet);
                console.log(alf);
        //pt = new Point(x, y);
        //this.pointsSpline[j]=pt;

        this.verticesSpline = new Float32Array(this.pointsSpline.length * this.countAttribData);
        for (i = 0; i < this.pointsSpline.length; i++) {
            this.verticesSpline[i * this.countAttribData] = this.pointsSpline[i].x;
            this.verticesSpline[i * this.countAttribData + 1] = this.pointsSpline[i].y;
            for (var j = 0; j < 16; j++)
                this.verticesSpline[i * this.countAttribData + 3 + j] = this.pointsSpline[i].transformMatrix[j];
        }
    }
}

function click(ev, canvas) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect() ;

  Data.clickHandler(x - rect.left, canvas.height - (y - rect.top));
}

function mousedown(ev, canvas) {
    var x = ev.clientX; // x coordinate of a mouse pointer
    var y = ev.clientY; // y coordinate of a mouse pointer
    var rect = ev.target.getBoundingClientRect();

    Data.mousedownHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mouseup(ev, canvas) {
    var x = ev.clientX; // x coordinate of a mouse pointer
    var y = ev.clientY; // y coordinate of a mouse pointer
    var rect = ev.target.getBoundingClientRect();

    Data.mouseupHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mousemove(ev, canvas)
{
    var x = ev.clientX; // x coordinate of a mouse pointer
    var y = ev.clientY; // y coordinate of a mouse pointer
    var rect = ev.target.getBoundingClientRect();
    Data.mousemoveHandler(x - rect.left, canvas.height - (y - rect.top));
}