import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Grid from '@toast-ui/react-grid';
import 'tui-grid/dist/tui-grid.css';

const DataGrid = forwardRef(({ columns, data, readOnly }, ref) => {
  const gridRef = useRef(null);

  // 부모(App.jsx)에서 그리드 인스턴스에 접근 가능하도록 설정
  useImperativeHandle(ref, () => ({
    getInstance: () => gridRef.current.getInstance()
  }));

  // ★ 레이아웃 보정: 컬럼, 데이터, 혹은 화면 모드가 바뀔 때마다 그리드 크기를 재계산합니다.
  useEffect(() => {
    if (gridRef.current) {
      const instance = gridRef.current.getInstance();
      instance.refreshLayout();
    }
  }, [columns, data, readOnly]);

  // ★ 윈도우 리사이즈 대응: 브라우저 창 크기가 변할 때 그리드 너비를 자동으로 맞춥니다.
  useEffect(() => {
    const handleResize = () => {
      if (gridRef.current) {
        gridRef.current.getInstance().refreshLayout();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Grid
        ref={gridRef}
        data={data || []}
        columns={columns.map(col => ({
          ...col,
          // readOnly 상태일 때는 에디터를 끄고, 아닐 때는 전달받은 에디터 사용
          editor: readOnly ? null : (col.editor || 'text'),
          resizable: true,
          sortable: true
        }))}
        rowHeaders={['rowNum', 'checkbox']}
        bodyHeight="fitToParent" // ★ 부모 컨테이너 높이에 꽉 맞춤
        scrollX={true}
        scrollY={true}
        columnOptions={{ 
          resizable: true,
          minWidth: 120 // ★ 헤더 뭉침 방지를 위한 최소 너비 설정
        }}
      />
    </div>
  );
});

export default DataGrid;